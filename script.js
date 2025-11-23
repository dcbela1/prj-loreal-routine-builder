/* ------------------------------
   DOM ELEMENTS
------------------------------ */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");

const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* Cloudflare Worker URL — replace with YOURS */
const WORKER_URL = "https://lingering-cherry-b621.dcbela.workers.dev";

/* Holds selected products */
let selectedProducts = [];

/* Conversation history */
let messages = [
  {
    role: "system",
    content: `
You are a L'Oréal Routine Builder Assistant.
You ONLY answer questions about L'Oréal brands, skincare, haircare, makeup, fragrance, and routines.
Always use the selected products when generating routines.`
  }
];

/* ------------------------------
   LOAD PRODUCTS
------------------------------ */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* ------------------------------
   DISPLAY PRODUCT CARDS
------------------------------ */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");

  attachProductEvents(products);
}

/* ------------------------------
   CLICK EVENTS FOR PRODUCT CARDS
------------------------------ */
function attachProductEvents(products) {
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = parseInt(card.dataset.id);
      const product = products.find((p) => p.id === id);

      toggleProduct(product, card);
    });

    // Hover Description
    card.addEventListener("mouseenter", () => showDescription(card, products));
    card.addEventListener("mouseleave", () => hideDescription(card));
  });
}

/* ------------------------------
   TOGGLE SELECTED PRODUCTS
------------------------------ */
function toggleProduct(product, card) {
  const index = selectedProducts.findIndex((p) => p.id === product.id);

  if (index > -1) {
    selectedProducts.splice(index, 1);
    card.style.border = "1px solid #ccc";
  } else {
    selectedProducts.push(product);
    card.style.border = "3px solid #ff003b"; // L’Oréal color
  }

  saveSelections();
  renderSelectedProducts();
}

/* ------------------------------
   SHOW SELECTED PRODUCTS LIST
------------------------------ */
function renderSelectedProducts() {
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
    <div class="selected-item">
      ${p.name} 
      <button class="remove-btn" data-id="${p.id}">x</button>
    </div>`
    )
    .join("");

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id);
      selectedProducts = selectedProducts.filter((p) => p.id !== id);
      saveSelections();
      renderSelectedProducts();
    });
  });
}

/* ------------------------------
   PRODUCT DESCRIPTION ON HOVER
------------------------------ */
function showDescription(card, products) {
  const id = parseInt(card.dataset.id);
  const product = products.find((p) => p.id === id);

  const descBox = document.createElement("div");
  descBox.className = "desc-box";
  descBox.textContent = product.description;
  descBox.style.cssText = `
    position:absolute;
    background:white;
    padding:10px;
    border:1px solid #ccc;
    width:260px;
    z-index:10;
    font-size:14px;
    border-radius:6px;
  `;

  card.appendChild(descBox);
}

function hideDescription(card) {
  const desc = card.querySelector(".desc-box");
  if (desc) desc.remove();
}

/* ------------------------------
   SAVE TO LOCAL STORAGE
------------------------------ */
function saveSelections() {
  localStorage.setItem("lorealSelections", JSON.stringify(selectedProducts));
}

function loadSelections() {
  const stored = JSON.parse(localStorage.getItem("lorealSelections"));
  if (stored) {
    selectedProducts = stored;
    renderSelectedProducts();
  }
}

/* ------------------------------
   CATEGORY FILTER
------------------------------ */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const category = e.target.value;

  const filtered = products.filter((p) => p.category === category);
  displayProducts(filtered);
});

/* ------------------------------
   GENERATE ROUTINE
------------------------------ */
generateBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addMessage("Please select at least one product first.", "ai");
    return;
  }

  addMessage("✨ Generating your routine...", "ai");

  const productInfo = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description
  }));

  messages.push({
    role: "user",
    content: `Create a routine using these products: ${JSON.stringify(productInfo)}`
  });

  fetchChat();
});

/* ------------------------------
   FOLLOW-UP CHAT
------------------------------ */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  messages.push({ role: "user", content: text });

  userInput.value = "";
  fetchChat();
});

/* ------------------------------
   FETCH FROM CLOUDFLARE WORKER
------------------------------ */
async function fetchChat() {
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "No response.";

    addMessage(reply, "ai");

    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    addMessage("⚠️ Could not connect to AI server.", "ai");
  }
}

/* ------------------------------
   ADD MESSAGE TO CHAT WINDOW
------------------------------ */
function addMessage(text, sender = "ai") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "msg-user" : "msg-ai";
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Load saved selections */
loadSelections();
