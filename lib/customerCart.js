const CART_KEY = "stc_cart_v1";

function uid() {
    return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getCart() {
    if (typeof window === "undefined") return { items: [] };
    try {
        const raw = localStorage.getItem(CART_KEY);
        return raw ? JSON.parse(raw) : { items: [] };
    } catch { return { items: [] }; }
}

export function saveCart(cart) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
}

export function addCartItem(item) {
    const cart = getCart();
    const newItem = { ...item, id: uid() };
    cart.items.push(newItem);
    saveCart(cart);
    return newItem.id;
}

export function removeCartItem(id) {
    const cart = getCart();
    cart.items = cart.items.filter(i => i.id !== id);
    saveCart(cart);
}

export function clearCart() {
    saveCart({ items: [] });
}

export function getCartItems() {
    return getCart().items;
}

export function getCartCount() {
    return getCart().items.length;
}
