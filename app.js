
const $ = (id) => document.getElementById(id);

const productGrid = $("productGrid");
const status = $("status");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const sortFilter = $("sortFilter");
const productForm = $("productForm");
const adminPanel = $("adminPanel");
const loginForm = $("loginForm");
const accountStatus = $("accountStatus");

const STORAGE_KEYS = {
  products: "shopsmart_products_v1",
  cart: "shopsmart_cart_v1",
  user: "shopsmart_demo_user_v1"
};

let products = readStorage(STORAGE_KEYS.products, []);
let cart = readStorage(STORAGE_KEYS.cart, []);
let currentUser = readStorage(STORAGE_KEYS.user, null);
let editingId = null;

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    status.textContent = "Unable to save data in this browser.";
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function validProduct(product) {
  return product &&
    Number.isFinite(Number(product.id)) &&
    typeof product.title === "string" &&
    Number.isFinite(Number(product.price)) &&
    Number(product.price) > 0 &&
    typeof product.category === "string";
}

products = Array.isArray(products) ? products.filter(validProduct) : [];
cart = Array.isArray(cart) ? cart.filter(item =>
  item &&
  Number.isFinite(Number(item.id)) &&
  Number.isInteger(item.quantity) &&
  item.quantity > 0
) : [];

function saveProducts() {
  return saveStorage(STORAGE_KEYS.products, products);
}

function saveCart() {
  return saveStorage(STORAGE_KEYS.cart, cart);
}

function updateAccount() {
  accountStatus.textContent = currentUser
    ? `Signed in as ${currentUser.name} (demo)`
    : "Guest mode";

  adminPanel.hidden = !currentUser;
  $("logoutButton").hidden = !currentUser;
  $("loginForm").hidden = Boolean(currentUser);
}

function updateCategories() {
  const selected = categoryFilter.value;
  const categories = [...new Set(products.map(p => p.category))].sort();

  categoryFilter.replaceChildren(new Option("All categories", "all"));

  categories.forEach(category => {
    categoryFilter.add(new Option(category, category));
  });

  categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = products.filter(product =>
    product.title.toLowerCase().includes(query) ||
    product.category.toLowerCase().includes(query)
  );

  if (categoryFilter.value !== "all") {
    visible = visible.filter(p => p.category === categoryFilter.value);
  }

  if (sortFilter.value === "low-high") {
    visible.sort((a, b) => a.price - b.price);
  } else if (sortFilter.value === "high-low") {
    visible.sort((a, b) => b.price - a.price);
  } else if (sortFilter.value === "name") {
    visible.sort((a, b) => a.title.localeCompare(b.title));
  }

  productGrid.replaceChildren();

  if (visible.length === 0) {
    productGrid.textContent = "No products found. Try another search.";
    return;
  }

  visible.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    const safeImageURL = getSafeImageURL(product.image);

    if (safeImageURL) {
      image.src = safeImageURL;
      image.alt = product.title;
      image.loading = "lazy";
      image.onerror = () => image.removeAttribute("src");
    } else {
      image.alt = "No product image available";
    }

    const title = document.createElement("h3");
    title.textContent = product.title;

    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = `₹${product.price.toFixed(2)}`;

    const addButton = document.createElement("button");
    addButton.textContent = "Add to cart";
    addButton.addEventListener("click", () => addToCart(product.id));

    card.append(image, title, category, price, addButton);

    if (currentUser) {
      const editButton = document.createElement("button");
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => startEdit(product.id));

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteProduct(product.id));

      card.append(editButton, deleteButton);
    }

    productGrid.append(card);
  });
}

function getSafeImageURL(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderCart() {
  const cartItems = $("cartItems");
  cartItems.replaceChildren();

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  $("cartCount").textContent = `Cart items: ${count}`;

  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;

    const row = document.createElement("div");
    row.className = "cart-item";

    const description = document.createElement("span");
    description.textContent =
      `${product.title} × ${item.quantity} — ₹${(product.price * item.quantity).toFixed(2)} `;

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      cart = cart.filter(entry => entry.id !== item.id);
      if (saveCart()) renderCart();
    });

    row.append(description, removeButton);
    cartItems.append(row);
  });
}

function addToCart(id) {
  const existing = cart.find(item => item.id === id);

  if (existing) existing.quantity += 1;
  else cart.push({ id, quantity: 1 });

  if (saveCart()) renderCart();
}

function resetProductForm() {
  productForm.reset();
  editingId = null;
  $("editProductId").value = "";
  $("saveProductButton").textContent = "Add product";
  $("cancelEditButton").hidden = true;
}

function startEdit(id) {
  const product = products.find(p => p.id === id);
  if (!product || !currentUser) return;

  editingId = id;
  $("editProductId").value = String(id);
  $("productName").value = product.title;
  $("productPrice").value = product.price;
  $("productCategory").value = product.category;
  $("productImage").value = product.image || "";
  $("saveProductButton").textContent = "Save changes";
  $("cancelEditButton").hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteProduct(id) {
  if (!currentUser) return;
  if (!confirm("Delete this product?")) return;

  products = products.filter(p => p.id !== id);
  cart = cart.filter(item => item.id !== id);

  if (!saveProducts() || !saveCart()) return;

  resetProductForm();
  updateCategories();
  renderProducts();
  renderCart();
  status.textContent = "Product deleted.";
}

productForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!currentUser) return;

  const title = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const category = $("productCategory").value.trim();
  const image = $("productImage").value.trim();

  if (!title || !category || !Number.isFinite(price) || price <= 0) {
    status.textContent = "Enter a valid name, category, and positive price.";
    return;
  }

  if (image && !getSafeImageURL(image)) {
    status.textContent = "Enter a valid HTTP or HTTPS image URL.";
    return;
  }

  if (editingId !== null) {
    products = products.map(p => p.id === editingId
      ? { ...p, title, price, category, image }
      : p
    );
  } else {
    const id = products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    products.push({ id, title, price, category, image });
  }

  if (!saveProducts()) return;

  resetProductForm();
  updateCategories();
  renderProducts();
  status.textContent = "Product saved successfully.";
});

$("cancelEditButton").addEventListener("click", resetProductForm);

loginForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = $("userName").value.trim();
  if (!name) return;

  currentUser = { name: name.slice(0, 50) };

  if (!saveStorage(STORAGE_KEYS.user, currentUser)) {
    currentUser = null;
    return;
  }

  updateAccount();
  renderProducts();
});

$("logoutButton").addEventListener("click", () => {
  currentUser = null;

  try {
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    status.textContent = "Could not clear demo login state.";
  }

  resetProductForm();
  updateAccount();
  renderProducts();
});

searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
sortFilter.addEventListener("change", renderProducts);

updateAccount();
updateCategories();
renderProducts();
renderCart();
status.textContent = products.length
  ? "Products loaded from your saved catalog."
  : "No saved products yet. Sign in to add your first product.";
