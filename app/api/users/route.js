import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { ROLE_DEFINITIONS, canManageBranch, canManageSystem, normalizeRole } from "../../../lib/permissions";
import { createDefaultBranchUserFields } from "../../../lib/branches";
import {
    availabilityNeedsAdminApproval,
    canSelfEditEligibility,
    getChangedStaffProfileSections,
    isAvailabilityOnlyChange,
    isEligibilityOnlyChange,
    normalizeStaffMember,
    normalizeStaffProfile,
    normalizeStaffProfileMeta
} from "../../../lib/staffProfiles";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const authUser = await adminAuth.getUser(uid);
    
    const userRef = adminDb.collection("users").doc(uid);
    let userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        // Safe auto-creation in case the user exists in Firebase Auth but has no Firestore document profile yet
        const usersSnap = await adminDb.collection("users").limit(1).get();
        const isFirst = usersSnap.empty;
        
        const newUser = {
            uid,
            name: decodedToken.name || decodedToken.email.split("@")[0],
            email: decodedToken.email,
            photoURL: authUser.photoURL || decodedToken.picture || "",
            role: isFirst ? "super-admin" : "cleaner",
            departmentIds: isFirst ? ROLE_DEFINITIONS["super-admin"].departments : ROLE_DEFINITIONS.cleaner.departments,
            ...createDefaultBranchUserFields(isFirst ? "super-admin" : "cleaner"),
            teamId: "",
            status: isFirst ? "approved" : "pending_approval",
            createdAt: new Date().toISOString()
        };
        await userRef.set(newUser);
        return newUser;
    }
    
    const userData = userDoc.data();
    const syncPatch = {};
    if (authUser.photoURL && authUser.photoURL !== (userData.photoURL || "")) {
        syncPatch.photoURL = authUser.photoURL;
    }
    if (Object.keys(syncPatch).length > 0) {
        await userRef.update(syncPatch);
        Object.assign(userData, syncPatch);
    }
    if (userData.status === "disabled") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

// 1. READ: Own user details (type=me) OR Admin-only pending user approvals loader OR registered approved team leaders
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        
        if (type === "me") {
            return NextResponse.json(normalizeStaffMember(user), { status: 200 });
        }
        
        if (type === "field-staff") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Forbidden: Only branch managers can view field staff." }, { status: 403 });
            }
            const includePending = searchParams.get("includePending") === "1";
            const snapshot = await adminDb.collection("users").get();
            const list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const role = normalizeRole(data.role);
                const statusAllowed = includePending ? ["approved", "pending_approval"].includes(data.status) : data.status === "approved";
                if (statusAllowed && ["cleaner", "supervisor", "employee", "subcontractor"].includes(role)) {
                    list.push(normalizeStaffMember(data));
                }
            });
            return NextResponse.json(list, { status: 200 });
        }

        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can review users." }, { status: 403 });
        }
        
        // --- AUTO-SYNC FIREBASE AUTH USERS TO FIRESTORE PROFILES ---
        try {
            const listUsersResult = await adminAuth.listUsers(1000);
            for (const authUser of listUsersResult.users) {
                const userRef = adminDb.collection("users").doc(authUser.uid);
                const userDoc = await userRef.get();
                if (!userDoc.exists) {
                    const usersSnap = await adminDb.collection("users").limit(1).get();
                    const isFirst = usersSnap.empty;
                    
                    await userRef.set({
                        uid: authUser.uid,
                        name: authUser.displayName || authUser.email.split("@")[0],
                        email: authUser.email,
                        photoURL: authUser.photoURL || "",
                        role: isFirst ? "super-admin" : "cleaner",
                        departmentIds: isFirst ? ROLE_DEFINITIONS["super-admin"].departments : ROLE_DEFINITIONS.cleaner.departments,
                        ...createDefaultBranchUserFields(isFirst ? "super-admin" : "cleaner"),
                        teamId: "",
                        status: isFirst ? "approved" : "pending_approval",
                        createdAt: new Date().toISOString()
                    });
                }
            }
        } catch (syncErr) {
            console.error("Auto-sync of Firebase Auth users failed:", syncErr);
        }
        // -----------------------------------------------------------
        
        let query = adminDb.collection("users");
        let roleFilter = null;
        if (type === "leaders") {
            query = query.where("status", "==", "approved");
            roleFilter = ["team-leader", "cleaner", "supervisor"];
        } else if (type === "customers") {
            query = query.where("role", "==", "customer").where("status", "==", "approved");
        } else {
            query = query.where("status", "==", "pending_approval");
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const role = normalizeRole(data.role);
            if (!roleFilter || roleFilter.includes(data.role) || roleFilter.includes(role)) {
                list.push(normalizeStaffMember(data));
            }
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Users Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. WRITE: Admin-only activation resolving (Approve / Reject / Promote-to-Admin)
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can modify user roles and statuses." }, { status: 403 });
        }
        
        const { targetUid, action } = await request.json();
        
        if (!targetUid || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        
        const userRef = adminDb.collection("users").doc(targetUid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }
        
        if (action === "approve") {
            const existingData = normalizeStaffMember(userDoc.data());
            const nowIso = new Date().toISOString();
            const approvalUpdate = {
                status: "approved",
                updatedAt: nowIso
            };

            if (existingData.staffProfileRequest?.requestedProfile) {
                approvalUpdate.staffProfile = normalizeStaffProfile(existingData.staffProfileRequest.requestedProfile);
                approvalUpdate.staffProfileRequest = null;
                approvalUpdate.staffProfileMeta = {
                    ...normalizeStaffProfileMeta(existingData.staffProfileMeta),
                    status: "approved",
                    approvedAt: nowIso,
                    lastAdminReviewAt: nowIso,
                    rejectionReason: ""
                };
            }

            await userRef.update(approvalUpdate);
            return NextResponse.json({ message: "User account activated successfully." }, { status: 200 });
        } else if (action === "reject") {
            // Delete user document profile
            await userRef.delete();
            // Delete user from Firebase Auth
            try {
                await adminAuth.deleteUser(targetUid);
            } catch (delErr) {
                console.error("Failed to delete auth user during rejection cleanup:", delErr);
            }
            return NextResponse.json({ message: "User registration rejected and credentials deleted." }, { status: 200 });
        } else if (action === "make_admin" || action === "make_super_admin") {
            await userRef.update({
                role: "super-admin",
                departmentIds: ROLE_DEFINITIONS["super-admin"].departments,
                updatedAt: new Date().toISOString()
            });
            return NextResponse.json({ message: "User promoted to Super Admin role." }, { status: 200 });
        } else {
            return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
        }
        
    } catch (err) {
        console.error("POST Process User Approval Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 3. UPDATE: Update own profile details or Admin updating another user
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const body = await request.json();
        
        if (body.updateSelf) {
            if (!body.name && !body.photoURL) {
                return NextResponse.json({ error: "At least one profile field is required" }, { status: 400 });
            }
            const userRef = adminDb.collection("users").doc(user.uid);
            const updatePayload = {
                updatedAt: new Date().toISOString()
            };
            if (body.name) {
                updatePayload.name = body.name;
            }
            if (typeof body.photoURL === "string") {
                updatePayload.photoURL = body.photoURL;
            }
            await userRef.update(updatePayload);
            
            const docSnap = await userRef.get();
            return NextResponse.json({ message: "Profile updated successfully", user: normalizeStaffMember(docSnap.data()) }, { status: 200 });
        }

        if (body.updateSelfStaffProfile) {
            const userRef = adminDb.collection("users").doc(user.uid);
            const docSnap = await userRef.get();
            if (!docSnap.exists) {
                return NextResponse.json({ error: "User profile not found" }, { status: 404 });
            }

            const currentData = normalizeStaffMember(docSnap.data());
            const nextProfile = normalizeStaffProfile(body.staffProfile);
            const changedSections = getChangedStaffProfileSections(currentData.staffProfile, nextProfile);

            if (changedSections.length === 0) {
                return NextResponse.json({ error: "No profile changes were detected." }, { status: 400 });
            }

            const nowIso = new Date().toISOString();
            const currentMeta = normalizeStaffProfileMeta(currentData.staffProfileMeta);

            if (isEligibilityOnlyChange(changedSections) && currentMeta.status === "approved") {
                if (!canSelfEditEligibility(currentMeta)) {
                    return NextResponse.json({ error: "Eligibility can only be edited once every 48 hours after approval." }, { status: 400 });
                }

                const nextData = {
                    ...currentData,
                    staffProfile: {
                        ...currentData.staffProfile,
                        eligibility: nextProfile.eligibility
                    },
                    staffProfileMeta: {
                        ...currentMeta,
                        lastEligibilityUpdateAt: nowIso,
                        rejectionReason: ""
                    },
                    updatedAt: nowIso
                };

                await userRef.set(nextData);
                return NextResponse.json({ message: "Eligibility updated successfully.", user: normalizeStaffMember(nextData) }, { status: 200 });
            }

            if (isAvailabilityOnlyChange(changedSections)) {
                const needsApproval = availabilityNeedsAdminApproval(
                    currentData.staffProfile.availability,
                    nextProfile.availability,
                    Date.now()
                );

                if (needsApproval) {
                    const nextData = {
                        ...currentData,
                        staffProfileRequest: {
                            requestedProfile: {
                                ...currentData.staffProfile,
                                availability: nextProfile.availability
                            },
                            changedSections,
                            submittedAt: nowIso,
                            submittedByUid: user.uid,
                            submittedByName: currentData.name || currentData.email || "Staff member"
                        },
                        staffProfileMeta: {
                            ...currentMeta,
                            status: "pending_admin_review",
                            lastSubmittedAt: nowIso,
                            rejectionReason: ""
                        },
                        updatedAt: nowIso
                    };

                    await userRef.set(nextData);
                    return NextResponse.json({
                        message: "Availability changes inside the next 48 hours were sent to branch admin for approval.",
                        user: normalizeStaffMember(nextData)
                    }, { status: 200 });
                }

                const nextData = {
                    ...currentData,
                    staffProfile: {
                        ...currentData.staffProfile,
                        availability: nextProfile.availability
                    },
                    updatedAt: nowIso
                };

                await userRef.set(nextData);
                return NextResponse.json({
                    message: "Availability updated successfully and is now live for scheduling.",
                    user: normalizeStaffMember(nextData)
                }, { status: 200 });
            }

            const nextData = {
                ...currentData,
                staffProfileRequest: {
                    requestedProfile: nextProfile,
                    changedSections,
                    submittedAt: nowIso,
                    submittedByUid: user.uid,
                    submittedByName: currentData.name || currentData.email || "Staff member"
                },
                staffProfileMeta: {
                    ...currentMeta,
                    status: "pending_admin_review",
                    lastSubmittedAt: nowIso,
                    rejectionReason: ""
                },
                updatedAt: nowIso
            };

            await userRef.set(nextData);
            return NextResponse.json({ message: "Profile update submitted for branch admin approval.", user: normalizeStaffMember(nextData) }, { status: 200 });
        }

        if (body.updateStaffProfileDirect) {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Forbidden: Only branch administrators can directly edit staff profiles." }, { status: 403 });
            }

            const { targetUid, staffProfile } = body;
            if (!targetUid) {
                return NextResponse.json({ error: "Missing target user UID." }, { status: 400 });
            }

            const userRef = adminDb.collection("users").doc(targetUid);
            const docSnap = await userRef.get();
            if (!docSnap.exists) {
                return NextResponse.json({ error: "User profile not found" }, { status: 404 });
            }

            const currentData = normalizeStaffMember(docSnap.data());
            const nowIso = new Date().toISOString();
            const nextData = {
                ...currentData,
                staffProfile: normalizeStaffProfile(staffProfile),
                staffProfileRequest: null,
                staffProfileMeta: {
                    ...normalizeStaffProfileMeta(currentData.staffProfileMeta),
                    lastAdminReviewAt: nowIso,
                    rejectionReason: ""
                },
                updatedAt: nowIso
            };

            await userRef.set(nextData);
            return NextResponse.json({ message: "Staff profile updated successfully.", user: normalizeStaffMember(nextData) }, { status: 200 });
        }

        if (body.reviewStaffProfileRequest) {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Forbidden: Only branch administrators can review staff profile requests." }, { status: 403 });
            }

            const { targetUid, action, rejectionReason } = body;
            if (!targetUid || !action) {
                return NextResponse.json({ error: "Missing required review fields." }, { status: 400 });
            }

            const userRef = adminDb.collection("users").doc(targetUid);
            const docSnap = await userRef.get();
            if (!docSnap.exists) {
                return NextResponse.json({ error: "User profile not found" }, { status: 404 });
            }

            const targetData = normalizeStaffMember(docSnap.data());
            if (!targetData.staffProfileRequest?.requestedProfile) {
                return NextResponse.json({ error: "There is no pending staff profile request for this user." }, { status: 400 });
            }

            const nowIso = new Date().toISOString();
            let nextData;

            if (action === "approve") {
                nextData = {
                    ...targetData,
                    staffProfile: normalizeStaffProfile(targetData.staffProfileRequest.requestedProfile),
                    staffProfileRequest: null,
                    staffProfileMeta: {
                        ...normalizeStaffProfileMeta(targetData.staffProfileMeta),
                        status: "approved",
                        approvedAt: nowIso,
                        lastAdminReviewAt: nowIso,
                        rejectionReason: ""
                    },
                    updatedAt: nowIso
                };
            } else if (action === "reject") {
                nextData = {
                    ...targetData,
                    staffProfileRequest: null,
                    staffProfileMeta: {
                        ...normalizeStaffProfileMeta(targetData.staffProfileMeta),
                        status: targetData.staffProfileMeta?.approvedAt ? "approved" : "incomplete",
                        lastAdminReviewAt: nowIso,
                        rejectionReason: rejectionReason || "Branch admin rejected the submitted profile changes."
                    },
                    updatedAt: nowIso
                };
            } else {
                return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
            }

            await userRef.set(nextData);
            return NextResponse.json({ message: `Staff profile request ${action}d successfully.`, user: normalizeStaffMember(nextData) }, { status: 200 });
        }
        
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can update user details." }, { status: 403 });
        }
        
        const { targetUid, teamId, role, branchId, branchName, branchIds, departmentIds } = body;
        if (!targetUid) {
            return NextResponse.json({ error: "Missing target user UID" }, { status: 400 });
        }
        
        const userRef = adminDb.collection("users").doc(targetUid);
        const docSnap = await userRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }
        
        const targetUserData = docSnap.data();
        const updatedData = {
            ...targetUserData,
            role: role || targetUserData.role,
            branchId: branchId !== undefined ? branchId : (targetUserData.branchId || "ottawa-ca"),
            branchIds: branchIds !== undefined ? branchIds : (targetUserData.branchIds || [targetUserData.branchId || "ottawa-ca"]),
            branchName: branchName !== undefined ? branchName : (targetUserData.branchName || "Ottawa"),
            departmentIds: departmentIds || ROLE_DEFINITIONS[role || targetUserData.role]?.departments || targetUserData.departmentIds || [],
            teamId: teamId !== undefined ? teamId : targetUserData.teamId,
            updatedAt: new Date().toISOString()
        };
        
        await userRef.set(updatedData);
        return NextResponse.json({ message: "User updated successfully", user: updatedData }, { status: 200 });
    } catch (err) {
        console.error("PUT User Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
