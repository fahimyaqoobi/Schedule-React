# Requirements Document

## Introduction

The Services Catalog Management System enables administrators to manage a comprehensive catalog of cleaning and maintenance services with flexible pricing models, subcategories, and extras. The system supports combo bookings with automatic discounts and integrates with the existing Next.js scheduling application.

## Glossary

- **Service_Catalog_Manager**: The system component responsible for managing services, subcategories, and extras
- **Service**: A top-level offering (e.g., House Cleaning, Window Cleaning)
- **Subcategory**: An optional subdivision of a Service based on size, type, or other criteria
- **Extra**: An additional purchasable option specific to a Service or Subcategory
- **Pricing_Model**: The method used to calculate service cost (flat rate or unit-based)
- **Combo_Booking**: A booking containing multiple Services
- **Discount_Calculator**: The component that calculates combo booking discounts
- **Administrator**: A user with admin role authorized to manage the service catalog
- **Booking_System**: The existing system for scheduling and managing appointments

## Requirements

### Requirement 1: Service Management

**User Story:** As an administrator, I want to create, read, update, and delete services, so that I can maintain an accurate catalog of offerings.

#### Acceptance Criteria

1. WHEN an Administrator creates a Service with a name and Pricing_Model, THE Service_Catalog_Manager SHALL store the Service in the database
2. WHEN an Administrator requests all Services, THE Service_Catalog_Manager SHALL return a list of all Services with their properties
3. WHEN an Administrator updates a Service, THE Service_Catalog_Manager SHALL persist the changes and return the updated Service
4. WHEN an Administrator deletes a Service, THE Service_Catalog_Manager SHALL remove the Service and all associated Subcategories and Extras
5. THE Service_Catalog_Manager SHALL validate that Service names are unique within the catalog
6. WHEN a Service is created or updated, THE Service_Catalog_Manager SHALL validate that the Pricing_Model is either "flat_rate" or "unit_based"

### Requirement 2: Subcategory Management

**User Story:** As an administrator, I want to create optional subcategories for services, so that I can offer size-based or type-based variations of services.

#### Acceptance Criteria

1. WHERE a Service supports subcategories, WHEN an Administrator creates a Subcategory with a name and price, THE Service_Catalog_Manager SHALL associate the Subcategory with the parent Service
2. WHEN an Administrator requests Subcategories for a Service, THE Service_Catalog_Manager SHALL return all Subcategories associated with that Service
3. WHEN an Administrator updates a Subcategory, THE Service_Catalog_Manager SHALL persist the changes without affecting other Subcategories
4. WHEN an Administrator deletes a Subcategory, THE Service_Catalog_Manager SHALL remove the Subcategory and all associated Extras
5. THE Service_Catalog_Manager SHALL allow Services to exist without any Subcategories
6. THE Service_Catalog_Manager SHALL validate that Subcategory names are unique within their parent Service

### Requirement 3: Extras Management

**User Story:** As an administrator, I want to create, update, and delete extras for services and subcategories, so that I can offer additional purchasable options.

#### Acceptance Criteria

1. WHEN an Administrator creates an Extra with a name and price, THE Service_Catalog_Manager SHALL associate the Extra with either a Service or a Subcategory
2. WHEN an Administrator requests Extras for a Service, THE Service_Catalog_Manager SHALL return all Extras associated with that Service
3. WHERE a Service has Subcategories, WHEN an Administrator requests Extras for a Subcategory, THE Service_Catalog_Manager SHALL return all Extras associated with that Subcategory
4. WHEN an Administrator updates an Extra, THE Service_Catalog_Manager SHALL persist the changes without affecting other Extras
5. WHEN an Administrator deletes an Extra, THE Service_Catalog_Manager SHALL remove the Extra from the database
6. THE Service_Catalog_Manager SHALL validate that Extra names are unique within their parent Service or Subcategory

### Requirement 4: Pricing Model Support

**User Story:** As an administrator, I want to configure different pricing models for services, so that I can support both flat-rate and unit-based pricing.

#### Acceptance Criteria

1. WHERE a Service has Pricing_Model set to "flat_rate", THE Service_Catalog_Manager SHALL store a single price value for the Service or Subcategory
2. WHERE a Service has Pricing_Model set to "unit_based", THE Service_Catalog_Manager SHALL store a per-unit price for the Service or Subcategory
3. WHEN calculating the total price for a unit-based Service, THE Service_Catalog_Manager SHALL multiply the per-unit price by the quantity
4. WHEN calculating the total price for a flat-rate Service, THE Service_Catalog_Manager SHALL use the stored price regardless of quantity
5. THE Service_Catalog_Manager SHALL include Extra prices in the total price calculation

### Requirement 5: Combo Booking Creation

**User Story:** As a user, I want to create bookings with multiple services, so that I can schedule multiple services for a single appointment.

#### Acceptance Criteria

1. WHEN a user creates a Combo_Booking with multiple Services, THE Booking_System SHALL store all selected Services with the booking
2. WHEN a user adds a Service to a Combo_Booking, THE Booking_System SHALL allow selection of Subcategory and Extras for that Service
3. WHERE a Service has unit-based pricing, WHEN adding to a Combo_Booking, THE Booking_System SHALL require quantity input
4. THE Booking_System SHALL allow a Combo_Booking to contain at least two Services
5. THE Booking_System SHALL validate that all selected Services exist in the Service_Catalog_Manager

### Requirement 6: Combo Booking Discount

**User Story:** As a user, I want to receive an automatic discount on combo bookings, so that I am incentivized to purchase multiple services together.

#### Acceptance Criteria

1. WHEN a Combo_Booking contains two or more Services, THE Discount_Calculator SHALL apply a 10 percent discount to the subtotal
2. THE Discount_Calculator SHALL calculate the discount before tax calculations
3. WHEN a booking contains only one Service, THE Discount_Calculator SHALL apply no discount
4. THE Discount_Calculator SHALL calculate the subtotal by summing all Service prices, Subcategory prices, and Extra prices
5. THE Booking_System SHALL display the subtotal, discount amount, and final price before tax separately

### Requirement 7: Initial Service Catalog

**User Story:** As an administrator, I want the system to support the predefined service list, so that I can start with a complete catalog.

#### Acceptance Criteria

1. THE Service_Catalog_Manager SHALL support storing the following Services: House Cleaning, Window Cleaning, Gutter Cleaning, Exterior Pressure Washing, and Lawn Mowing
2. WHERE the Service_Catalog_Manager is initialized for the first time, THE Service_Catalog_Manager SHALL create default entries for the five predefined Services
3. WHEN an Administrator views the service catalog, THE Service_Catalog_Manager SHALL display all Services including the predefined ones

### Requirement 8: Authorization and Security

**User Story:** As a system administrator, I want only authorized administrators to manage the service catalog, so that the catalog remains accurate and secure.

#### Acceptance Criteria

1. WHEN a user attempts to create, update, or delete a Service, THE Service_Catalog_Manager SHALL verify the user has admin role
2. IF a user without admin role attempts catalog management operations, THEN THE Service_Catalog_Manager SHALL return an authorization error
3. THE Service_Catalog_Manager SHALL use the existing authentication mechanism from the Booking_System
4. WHEN a user requests to view the service catalog, THE Service_Catalog_Manager SHALL allow access to all authenticated users

### Requirement 9: Data Validation and Integrity

**User Story:** As an administrator, I want the system to validate all inputs, so that the service catalog maintains data integrity.

#### Acceptance Criteria

1. WHEN creating or updating a Service, Subcategory, or Extra, THE Service_Catalog_Manager SHALL validate that required fields are present
2. WHEN a price value is provided, THE Service_Catalog_Manager SHALL validate that it is a positive number
3. WHEN a quantity is provided for unit-based pricing, THE Service_Catalog_Manager SHALL validate that it is a positive integer
4. IF validation fails, THEN THE Service_Catalog_Manager SHALL return a descriptive error message
5. THE Service_Catalog_Manager SHALL prevent deletion of Services that are referenced in active bookings

### Requirement 10: Integration with Existing Booking System

**User Story:** As a developer, I want the service catalog to integrate seamlessly with the existing booking system, so that the application maintains consistency.

#### Acceptance Criteria

1. THE Service_Catalog_Manager SHALL use the same Firebase database as the Booking_System
2. THE Service_Catalog_Manager SHALL use the same authentication and authorization patterns as the Booking_System
3. WHEN a booking is created with Services from the catalog, THE Booking_System SHALL store references to the Service identifiers
4. THE Service_Catalog_Manager SHALL provide an API that follows the same RESTful patterns as existing API routes
5. THE Service_Catalog_Manager SHALL return responses in the same JSON format as the Booking_System
