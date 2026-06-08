<?php
/* =============================================
   api/orders.php
   GET    /api/orders.php             → list all orders (joined with product name)
   GET    /api/orders.php?id=1        → single order
   POST   /api/orders.php             → create via stored procedure sp_place_order
                                        { customer, product_id, qty }
   PUT    /api/orders.php             → advance/update status { id, status }
   DELETE /api/orders.php?id=1        → delete order
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = getDB();

function jsonBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

try {
    switch ($method) {

        /* ---- READ ---- */
        case 'GET':
            if (isset($_GET['id'])) {
                $stmt = $pdo->prepare("
                    SELECT o.*, p.name AS product_name
                    FROM orders o
                    LEFT JOIN products p ON p.id = o.product_id
                    WHERE o.id = ?");
                $stmt->execute([(int)$_GET['id']]);
                $row = $stmt->fetch();
                if (!$row) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
                echo json_encode($row);
            } else {
                $stmt = $pdo->query("
                    SELECT o.*, p.name AS product_name
                    FROM orders o
                    LEFT JOIN products p ON p.id = o.product_id
                    ORDER BY o.id DESC");
                echo json_encode($stmt->fetchAll());
            }
            break;

        /* ---- CREATE (via stored procedure) ---- */
        case 'POST':
            $d = jsonBody();
            if (empty($d['customer']) || empty($d['product_id']) || empty($d['qty'])) {
                http_response_code(422);
                echo json_encode(['error' => 'customer, product_id, and qty are required']);
                break;
            }

            // Call the stored procedure sp_place_order
            $stmt = $pdo->prepare("CALL sp_place_order(:customer, :product_id, :qty, @order_code, @message)");
            $stmt->execute([
                'customer'   => trim($d['customer']),
                'product_id' => (int)$d['product_id'],
                'qty'        => (int)$d['qty'],
            ]);
            $stmt->closeCursor();

            // Fetch OUT parameters
            $out = $pdo->query("SELECT @order_code AS order_code, @message AS message")->fetch();

            if ($out['order_code']) {
                echo json_encode([
                    'success'    => true,
                    'order_code' => $out['order_code'],
                    'message'    => $out['message'],
                ]);
            } else {
                http_response_code(422);
                echo json_encode(['error' => $out['message']]);
            }
            break;

        /* ---- UPDATE STATUS ---- */
        case 'PUT':
            $d = jsonBody();
            if (empty($d['id']) || empty($d['status'])) {
                http_response_code(422);
                echo json_encode(['error' => 'id and status are required']);
                break;
            }
            $allowed = ['Pending', 'Processing', 'Shipped', 'Delivered'];
            if (!in_array($d['status'], $allowed, true)) {
                http_response_code(422);
                echo json_encode(['error' => 'Invalid status value']);
                break;
            }
            $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
            $stmt->execute([$d['status'], (int)$d['id']]);
            // Trigger trg_order_status_change fires automatically here
            echo json_encode(['success' => true, 'message' => 'Order status updated.']);
            break;

        /* ---- DELETE ---- */
        case 'DELETE':
            if (empty($_GET['id'])) { http_response_code(422); echo json_encode(['error' => 'id required']); break; }
            $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
            $stmt->execute([(int)$_GET['id']]);
            if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
            echo json_encode(['success' => true, 'message' => 'Order deleted.']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
