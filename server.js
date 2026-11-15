const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined });
const JWT_SECRET = process.env.JWT_SECRET;
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

async function setupDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC(12,2) NOT NULL DEFAULT 0, image_url TEXT NOT NULL DEFAULT '', description TEXT DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS orders (id BIGSERIAL PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, address TEXT NOT NULL, payment_method TEXT NOT NULL, items JSONB NOT NULL, total NUMERIC(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payment_status TEXT NOT NULL DEFAULT 'unverified', created_at TIMESTAMPTZ DEFAULT NOW());`);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query('INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING', [process.env.ADMIN_EMAIL.toLowerCase(), hash]);
  }
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in as the store administrator.' }); }
}
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'Extravagant API'}));
app.get('/api/config', (_req,res)=>res.json({whatsappNumber: process.env.WHATSAPP_NUMBER || '260000000000'}));
app.get('/api/products', async (_req,res)=>{
  try { const {rows}=await pool.query('SELECT * FROM products WHERE active=true ORDER BY created_at DESC'); res.json(rows); }
  catch(e){ console.error(e); res.status(500).json({error:'Could not load products.'}); }
});
app.post('/api/orders', async (req,res)=>{
  try {
    const {customer_name,phone,email,address,payment_method,items}=req.body;
    if(!customer_name||!phone||!address||!payment_method||!Array.isArray(items)||!items.length) return res.status(400).json({error:'Complete all required checkout fields.'});
    const ids=items.map(i=>Number(i.product_id)).filter(Number.isInteger);
    if(!ids.length) return res.status(400).json({error:'Your cart contains an invalid product.'});
    const {rows}=await pool.query('SELECT id,name,price,active FROM products WHERE id=ANY($1::int[]) AND active=true',[ids]);
    const byId=new Map(rows.map(p=>[p.id,p])); let total=0; const verified=[];
    for(const item of items){const p=byId.get(Number(item.product_id));const qty=Math.max(1,Math.min(50,Number(item.quantity)||1));if(!p)return res.status(400).json({error:'A product is no longer available.'});const price=Number(p.price);total+=price*qty;verified.push({product_id:p.id,name:p.name,unit_price:price,quantity:qty});}
    const result=await pool.query(`INSERT INTO orders(customer_name,phone,email,address,payment_method,items,total) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[String(customer_name).slice(0,120),String(phone).slice(0,40),email?String(email).slice(0,160):null,String(address).slice(0,500),String(payment_method).slice(0,40),JSON.stringify(verified),total]);
    res.status(201).json({id:result.rows[0].id,total});
  } catch(e){console.error(e);res.status(500).json({error:'Could not submit your order. Please try again.'});}
});
app.post('/api/admin/login', async (req,res)=>{
  try {const email=String(req.body.email||'').toLowerCase();const {rows}=await pool.query('SELECT * FROM admins WHERE email=$1',[email]);const admin=rows[0];if(!admin||!await bcrypt.compare(String(req.body.password||''),admin.password_hash))return res.status(401).json({error:'Incorrect email or password.'});const token=jwt.sign({id:admin.id,email:admin.email},JWT_SECRET,{expiresIn:'8h'});res.json({token,email:admin.email});}
  catch(e){console.error(e);res.status(500).json({error:'Sign-in failed.'});}
});
app.get('/api/admin/products',requireAdmin,async(_req,res)=>{try{const {rows}=await pool.query('SELECT * FROM products ORDER BY created_at DESC');res.json(rows);}catch(e){res.status(500).json({error:'Could not load products.'});}});
app.post('/api/admin/products',requireAdmin,async(req,res)=>{try{const p=req.body; if(!p.name||!p.category)return res.status(400).json({error:'Product name and category are required.'});const {rows}=await pool.query('INSERT INTO products(name,category,price,image_url,description,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[p.name,p.category,Math.max(0,Number(p.price)||0),p.image_url||'',p.description||'',p.active!==false]);res.status(201).json(rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Could not save product.'});}});
app.put('/api/admin/products/:id',requireAdmin,async(req,res)=>{try{const p=req.body;const {rows}=await pool.query('UPDATE products SET name=$1,category=$2,price=$3,image_url=$4,description=$5,active=$6 WHERE id=$7 RETURNING *',[p.name,p.category,Math.max(0,Number(p.price)||0),p.image_url||'',p.description||'',!!p.active,req.params.id]);if(!rows[0])return res.status(404).json({error:'Product not found.'});res.json(rows[0]);}catch(e){console.error(e);res.status(500).json({error:'Could not update product.'});}});
app.delete('/api/admin/products/:id',requireAdmin,async(req,res)=>{try{await pool.query('DELETE FROM products WHERE id=$1',[req.params.id]);res.json({ok:true});}catch(e){res.status(500).json({error:'Could not delete product.'});}});
app.get('/api/admin/orders',requireAdmin,async(_req,res)=>{try{const {rows}=await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');res.json(rows);}catch(e){res.status(500).json({error:'Could not load orders.'});}});
app.patch('/api/admin/orders/:id',requireAdmin,async(req,res)=>{try{const {status,payment_status}=req.body;const allowedStatus=['pending','processing','completed','cancelled'];const allowedPayment=['unverified','paid','failed'];if(status&&!allowedStatus.includes(status))return res.status(400).json({error:'Invalid order status.'});if(payment_status&&!allowedPayment.includes(payment_status))return res.status(400).json({error:'Invalid payment status.'});const {rows}=await pool.query('UPDATE orders SET status=COALESCE($1,status),payment_status=COALESCE($2,payment_status) WHERE id=$3 RETURNING *',[status||null,payment_status||null,req.params.id]);if(!rows[0])return res.status(404).json({error:'Order not found.'});res.json(rows[0]);}catch(e){res.status(500).json({error:'Could not update order.'});}});

(async()=>{try{if(!JWT_SECRET)throw new Error('JWT_SECRET environment variable is required');if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL environment variable is required');await setupDatabase();app.listen(port,()=>console.log(`Extravagant running on port ${port}`));}catch(e){console.error('Startup failed:',e);process.exit(1);}})();
