# Wholesale Inventory Management System
## Tech Stack: HTML / CSS / JS + PHP + MySQL (XAMPP)

---

## Project Structure

```
wholesale-ims/
├── index.html              ← Main front-end (all tabs & modals)
├── wholesale_ims.sql       ← Database schema + sample data
├── config/
│   └── db.php              ← Database connection (PDO)
├── api/
│   ├── dashboard.php       ← GET  summary stats
│   ├── products.php        ← GET / POST / PUT / DELETE
│   ├── orders.php          ← GET / POST / PUT / DELETE
│   └── suppliers.php       ← GET / POST / PUT / DELETE
├── css/
│   └── style.css           ← All styles
└── js/
    ├── data.js             ← API endpoint URLs
    └── app.js              ← All CRUD logic (fetch-based)
```

---

## Setup Instructions (XAMPP)

### Step 1 — Install XAMPP
Download from: https://www.apachefriends.org
Install and launch the XAMPP Control Panel.
Start **Apache** and **MySQL**.

### Step 2 — Copy the project
Paste the `wholesale-ims` folder into:
```
C:\xampp\htdocs\wholesale-ims\
```

### Step 3 — Import the database
1. Open your browser and go to: http://localhost/phpmyadmin
2. Click **New** in the left sidebar
3. Create a database named `wholesale_ims`
4. Click the `wholesale_ims` database → go to **Import** tab
5. Click **Choose File** → select `wholesale_ims.sql`
6. Click **Go** to import

### Step 4 — Run the app
Open your browser and go to:
```
http://localhost/wholesale-ims/
```

---

## Database Credentials (config/db.php)
| Setting   | Default Value   |
|-----------|-----------------|
| Host      | localhost        |
| Database  | wholesale_ims    |
| Username  | root             |
| Password  | *(empty)*        |

If your XAMPP MySQL has a password set, update `DB_PASS` in `config/db.php`.

---

## Features

### Products
- Add, edit, delete products
- Linked to suppliers via foreign key
- Auto stock status: In Stock / Low Stock / Out of Stock

### Orders
- Place orders via **stored procedure** `sp_place_order`
  - Automatically deducts stock on order placement
  - Returns error if stock is insufficient
- Advance order status: Pending → Processing → Shipped → Delivered
- Status changes are logged automatically via **trigger** `trg_order_status_change`

### Suppliers
- Add, edit, delete suppliers
- Cannot delete a supplier with linked products (foreign key protection)

### Dashboard
- Live counts: total products, total orders, low-stock items
- Total inventory value
- Recent orders preview
- Low stock alert table

---

## SQL Highlights (for your report)

| Feature          | Location                  | Description                              |
|------------------|---------------------------|------------------------------------------|
| Primary Keys     | All tables                | `id` AUTO_INCREMENT                      |
| Foreign Keys     | products.supplier_id      | References suppliers(id)                 |
|                  | orders.product_id         | References products(id)                  |
| Stored Procedure | sp_place_order            | Inserts order + deducts stock atomically |
| Trigger          | trg_order_status_change   | Logs every order status change           |
| CRUD             | api/*.php                 | Full Create/Read/Update/Delete via PDO   |
