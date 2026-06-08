<?php
/* =============================================
    api/dashboard.php
    GET  →  summary stats + recent orders + low stock
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once '../config/db.php';

$pdo = getDB();

try {
    // Total products
    $totalProducts = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();

    // Total orders
    $totalOrders = (int)$pdo->query("SELECT COUNT(*) FROM orders")->fetchColumn();

    // Low stock count (stock <= 10)
    $lowStock = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE stock <= 10")->fetchColumn();

    // Total inventory value
    $inventoryValue = (float)$pdo->query("SELECT SUM(price * stock) FROM products")->fetchColumn();

    // Recent 4 orders
    $recentOrders = $pdo->query("
        SELECT o.order_code, o.customer, o.status, o.total
        FROM orders o
        ORDER BY o.id DESC
        LIMIT 4
    ")->fetchAll();

    // Low stock items
    $lowStockItems = $pdo->query("
        SELECT p.name, p.category, p.stock,
            CASE
                WHEN p.stock = 0  THEN 'Out of Stock'
                WHEN p.stock <= 10 THEN 'Low Stock'
                ELSE 'In Stock'
                END AS status
        FROM products p
        WHERE p.stock <= 10
        ORDER BY p.stock ASC
    ")->fetchAll();

    echo json_encode([
        'total_products'  => $totalProducts,
        'total_orders'    => $totalOrders,
        'low_stock_count' => $lowStock,
        'inventory_value' => $inventoryValue,
        'recent_orders'   => $recentOrders,
        'low_stock_items' => $lowStockItems,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
