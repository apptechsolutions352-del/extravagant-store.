const cfg = window.EXTRAVAGANT_CONFIG || {};
let whatsappNumber = (cfg.WHATSAPP_NUMBER || "260000000000").replace(/\D/g, "");
fetch('/api/config').then(r=>r.json()).then(c=>{if(c.whatsappNumber)whatsappNumber=String(c.whatsappNumber).replace(/\D/g,"");}).catch(()=>{});
const demoProducts = [
  {id:"demo-1",name:"Black / Silver Signature Frames",category:"Eyewear",price:0,image_url:"images/glasses-black-silver.jpeg",description:"Statement frames with silver detailing.",active:true},
  {id:"demo-2",name:"Clear / Silver Signature Frames",category:"Eyewear",price:0,image_url:"images/glasses-clear-silver.jpeg",description:"Clear frames with refined silver details.",active:true},
  {id:"demo-3",name:"Black / Gold Signature Frames",category:"Eyewear",price:0,image_url:"images/glasses-black-gold.jpeg",description:"Black frames with gold detailing.",active:true},
  {id:"demo-4",name:"Signature Eyewear — Detail",category:"Eyewear",price:0,image_url:"images/glasses-detail-1.jpeg",description:"A closer look at the finish.",active:true}
];
let products = [];
let cart = JSON.parse(localStorage.getItem("extravagant-cart") || "[]");
let currentFilter = "All";

const money = value => "K" + Number(value || 0).toLocaleString("en-ZM",{minimumFractionDigits:2,maximumFractionDigits:2});
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function waLink(message){return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;}

async function loadProducts(){
  try { const response=await fetch('/api/products'); if(!response.ok) throw new Error('API unavailable'); products=await response.json(); }
  catch(error){ console.warn('Using preview products until the Render database is connected.',error); products=demoProducts; }
  renderProducts();
}
function renderProducts(){
  const grid=document.getElementById("productGrid");
  const shown=products.filter(p=>currentFilter==="All"||p.category===currentFilter);
  if(!shown.length){grid.innerHTML='<p class="empty-state">No products in this collection yet.</p>';return;}
  grid.innerHTML=shown.map(p=>`
    <article class="product-card">
      <img class="product-image" src="${escapeHTML(p.image_url||"")}" alt="${escapeHTML(p.name)}" loading="lazy">
      <p class="product-meta">${escapeHTML(p.category)}</p>
      <h3>${escapeHTML(p.name)}</h3>
      <p class="product-price">${Number(p.price)>0?money(p.price):"Contact for price"}</p>
      <div class="product-actions">
        <button class="add-button" data-add="${escapeHTML(p.id)}">Add to bag</button>
        <button class="wa-button" data-wa="${escapeHTML(p.id)}">WhatsApp</button>
      </div>
    </article>`).join("");
}
function persistCart(){localStorage.setItem("extravagant-cart",JSON.stringify(cart));renderCart();}
function addToCart(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;const existing=cart.find(x=>String(x.id)===String(id));if(existing)existing.quantity++;else cart.push({...p,quantity:1});persistCart();}
function cartTotal(){return cart.reduce((sum,p)=>sum+(Number(p.price)||0)*p.quantity,0);}
function renderCart(){
  document.getElementById("cartCount").textContent=cart.reduce((s,p)=>s+p.quantity,0);
  document.getElementById("cartSubtotal").textContent=money(cartTotal());
  document.getElementById("checkoutTotal").textContent=money(cartTotal());
  const box=document.getElementById("cartItems");
  if(!cart.length){box.innerHTML='<p class="muted">Your bag is currently empty.</p>';return;}
  box.innerHTML=cart.map(p=>`<div class="cart-row">
    <img src="${escapeHTML(p.image_url||"")}" alt="">
    <div><h4>${escapeHTML(p.name)}</h4><p>${Number(p.price)>0?money(p.price):"Price to be confirmed"}</p>
    <div class="qty-controls"><button data-qty="${escapeHTML(p.id)}" data-change="-1">−</button><span>${p.quantity}</span><button data-qty="${escapeHTML(p.id)}" data-change="1">+</button></div></div>
    <button class="remove-item" data-remove="${escapeHTML(p.id)}" aria-label="Remove ${escapeHTML(p.name)}">×</button>
  </div>`).join("");
}
function openCart(){document.getElementById("cartOverlay").classList.add("open");document.getElementById("cartOverlay").setAttribute("aria-hidden","false");}
function closeCart(){document.getElementById("cartOverlay").classList.remove("open");document.getElementById("cartOverlay").setAttribute("aria-hidden","true");}
function openCheckout(){if(!cart.length){alert("Your bag is empty.");return;}closeCart();document.getElementById("checkoutModal").classList.add("open");document.getElementById("checkoutModal").setAttribute("aria-hidden","false");}
function closeCheckout(){document.getElementById("checkoutModal").classList.remove("open");document.getElementById("checkoutModal").setAttribute("aria-hidden","true");}
function orderOnWhatsApp(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;window.open(waLink(`Hello Extravagant, I am interested in ${p.name}. Please share availability and price.`),"_blank","noopener");}

document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]");if(add)addToCart(add.dataset.add);
  const wa=e.target.closest("[data-wa]");if(wa)orderOnWhatsApp(wa.dataset.wa);
  const remove=e.target.closest("[data-remove]");if(remove){cart=cart.filter(p=>String(p.id)!==remove.dataset.remove);persistCart();}
  const qty=e.target.closest("[data-qty]");if(qty){const p=cart.find(x=>String(x.id)===qty.dataset.qty);if(p){p.quantity+=Number(qty.dataset.change);if(p.quantity<=0)cart=cart.filter(x=>x!==p);persistCart();}}
  const category=e.target.closest("[data-category-link]");if(category){currentFilter=category.dataset.categoryLink;document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===currentFilter));renderProducts();}
});
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderProducts();}));
document.getElementById("cartOpen").addEventListener("click",openCart);
document.getElementById("cartClose").addEventListener("click",closeCart);
document.getElementById("continueShopping").addEventListener("click",closeCart);
document.getElementById("checkoutOpen").addEventListener("click",openCheckout);
document.getElementById("checkoutClose").addEventListener("click",closeCheckout);
document.getElementById("cartOverlay").addEventListener("click",e=>{if(e.target.id==="cartOverlay")closeCart();});
document.getElementById("menuToggle").addEventListener("click",()=>{const nav=document.getElementById("mainNav");const open=nav.classList.toggle("open");document.getElementById("menuToggle").setAttribute("aria-expanded",String(open));});
document.getElementById("year").textContent=new Date().getFullYear();
document.getElementById("contactWhatsApp").href=waLink("Hello Extravagant, I would like to make an enquiry.");

document.getElementById("checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget, message=document.getElementById("checkoutMessage"), button=form.querySelector('button[type="submit"]');
  if(!cart.length){message.textContent="Your bag is empty.";return;}
  const f=new FormData(form);
  const order={customer_name:String(f.get("customer_name")).trim(),phone:String(f.get("phone")).trim(),email:String(f.get("email")||"").trim()||null,address:String(f.get("address")).trim(),payment_method:String(f.get("payment_method")),items:cart.map(p=>({product_id:p.id,quantity:p.quantity}))};
  button.disabled=true;button.textContent="Submitting…";message.textContent="";
  try {
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(order)});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Order submission failed.');
    const ref=data.id, summary=cart.map(p=>`${p.quantity} x ${p.name}`).join(', ');
    const text=`Hello Extravagant. I have submitted order ${ref}. Items: ${summary}. Total: ${money(data.total)}. Payment method: ${order.payment_method}. Please confirm payment instructions.`;
    cart=[];persistCart();form.reset();message.textContent=`Order request ${ref} received. Opening WhatsApp so the team can confirm the next steps.`;
    window.open(waLink(text),'_blank','noopener');
  } catch(error){message.textContent=error.message||'We could not submit your order. Please try again.';}
  finally{button.disabled=false;button.textContent="Place order request";}
});

loadProducts();renderCart();
