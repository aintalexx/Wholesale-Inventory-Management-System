-- =============================================
--  wholesale_ims.sql
--  Run this in phpMyAdmin or MySQL CLI:
--    mysql -u root -p < wholesale_ims.sql
-- =============================================

CREATE DATABASE IF NOT EXISTS wholesale_ims
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE wholesale_ims;

-- -----------------------------------------------
-- Table: suppliers
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    contact    VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    category   VARCHAR(60)  NOT NULL,
    status     ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Table: products
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    sku         VARCHAR(40)    NOT NULL UNIQUE,
    name        VARCHAR(150)   NOT NULL,
    category    VARCHAR(60)    NOT NULL,
    price       DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    stock       INT            NOT NULL DEFAULT 0,
    supplier_id INT            NOT NULL,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Table: orders
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    order_code  VARCHAR(20)    NOT NULL UNIQUE,
    customer    VARCHAR(150)   NOT NULL,
    product_id  INT            NOT NULL,
    qty         INT            NOT NULL DEFAULT 1,
    total       DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
    order_date  DATE           NOT NULL,
    status      ENUM('Pending','Processing','Shipped','Delivered') NOT NULL DEFAULT 'Pending',
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Stored Procedure: sp_place_order
-- Inserts an order and deducts stock atomically
-- -----------------------------------------------
DROP PROCEDURE IF EXISTS sp_place_order;
DELIMITER $$
CREATE PROCEDURE sp_place_order(
    IN  p_customer   VARCHAR(150),
    IN  p_product_id INT,
    IN  p_qty        INT,
    OUT p_order_code VARCHAR(20),
    OUT p_message    VARCHAR(255)
)
BEGIN
    DECLARE v_price   DECIMAL(12,2);
    DECLARE v_stock   INT;
    DECLARE v_total   DECIMAL(14,2);
    DECLARE v_next_id INT;

    -- Lock the product row for update
    SELECT price, stock INTO v_price, v_stock
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF v_stock IS NULL THEN
        SET p_order_code = NULL;
        SET p_message    = 'Product not found.';
    ELSEIF v_stock < p_qty THEN
        SET p_order_code = NULL;
        SET p_message    = CONCAT('Insufficient stock. Available: ', v_stock);
    ELSE
        SET v_total = v_price * p_qty;

        -- Generate order code
        SELECT AUTO_INCREMENT INTO v_next_id
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders';

        SET p_order_code = CONCAT('ORD-', LPAD(v_next_id, 3, '0'));

        -- Insert the order
        INSERT INTO orders (order_code, customer, product_id, qty, total, order_date, status)
        VALUES (p_order_code, p_customer, p_product_id, p_qty, v_total, CURDATE(), 'Pending');

        -- Deduct stock
        UPDATE products SET stock = stock - p_qty WHERE id = p_product_id;

        SET p_message = 'Order placed successfully.';
    END IF;
END$$
DELIMITER ;

-- -----------------------------------------------
-- Trigger: trg_update_order_status_log
-- (simple audit: logs when an order reaches Delivered)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS order_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT          NOT NULL,
    order_code  VARCHAR(20)  NOT NULL,
    old_status  VARCHAR(20)  NOT NULL,
    new_status  VARCHAR(20)  NOT NULL,
    changed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_order_status_change;
DELIMITER $$
CREATE TRIGGER trg_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO order_log(order_id, order_code, old_status, new_status)
        VALUES (NEW.id, NEW.order_code, OLD.status, NEW.status);
    END IF;
END$$
DELIMITER ;

-- -----------------------------------------------
-- Sample Data: Suppliers
-- -----------------------------------------------
INSERT INTO suppliers (name, contact, email, category, status) VALUES
('TechPrime Co.',   'Jose Reyes',    'jose@techprime.ph',    'Electronics', 'Active'),
('FashionHub',      'Maria Santos',  'maria@fashionhub.com', 'Clothing',    'Active'),
('FoodSource Inc.', 'Pedro Cruz',    'pedro@foodsource.ph',  'Food & Bev',  'Active'),
('BuildRight',      'Ana Dela Cruz', 'ana@buildright.ph',    'Hardware',    'Inactive');

-- -----------------------------------------------
-- Sample Data: Products
-- -----------------------------------------------
INSERT INTO products (sku, name, category, price, stock, supplier_id) VALUES
('ELEC-001', 'Wireless Router',          'Electronics', 2850.00, 45,  1),
('ELEC-002', 'USB-C Hub 7-Port',         'Electronics', 1200.00, 8,   1),
('CLO-001',  'Polo Shirt (Bulk)',         'Clothing',     320.00, 200, 2),
('FOO-001',  'Bottled Water 1L (Case)',  'Food & Bev',   480.00, 3,   3),
('HDW-001',  'Power Drill Set',          'Hardware',    3500.00, 22,  4),
('CLO-002',  'Denim Jeans (Bulk)',        'Clothing',     890.00, 0,   2),
('ELEC-003', 'HDMI Cable 2m',            'Electronics',  250.00, 120, 1),
('HDW-002',  'Safety Helmet',            'Hardware',     650.00, 35,  4);

-- -----------------------------------------------
-- Sample Data: Orders
-- -----------------------------------------------
INSERT INTO orders (order_code, customer, product_id, qty, total, order_date, status) VALUES
('ORD-001', 'Metro Stores PH',    1,  5,  14250.00, '2026-05-28', 'Delivered'),
('ORD-002', 'Cebu Retail Co.',    3,  100,32000.00, '2026-05-30', 'Shipped'),
('ORD-003', 'Davao Supply Inc.',  2,  10, 12000.00, '2026-06-01', 'Processing'),
('ORD-004', 'Manila Trade Corp.', 5,  3,  10500.00, '2026-06-02', 'Pending'),
('ORD-005', 'BGC Hardware',       4,  50, 24000.00, '2026-06-03', 'Pending');
