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
