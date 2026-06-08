<?php
/* =============================================
   api/products.php
   GET    /api/products.php          → list all (with supplier name)
   GET    /api/products.php?id=1     → single product
   POST   /api/products.php          → create  { sku, name, category, price, stock, supplier_id }
   PUT    /api/products.php          → update  { id, sku, name, category, price, stock, supplier_id }
   DELETE /api/products.php?id=1     → delete
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = getDB();

/* ---- helper: stock status ---- */
function stockStatus(int $qty): string {
    if ($qty === 0)  return 'Out of Stock';
    if ($qty <= 10)  return 'Low Stock';
    return 'In Stock';
}

/* ---- helper: read JSON body ---- */
function jsonBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

try {
    switch ($method) {

        /* ---- READ ---- */
        case 'GET':
            if (isset($_GET['id'])) {
                $stmt = $pdo->prepare("
                    SELECT p.*, s.name AS supplier_name
                    FROM products p
                    LEFT JOIN suppliers s ON s.id = p.supplier_id
                    WHERE p.id = ?");
                $stmt->execute([(int)$_GET['id']]);
                $row = $stmt->fetch();
                if (!$row) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
                $row['status'] = stockStatus((int)$row['stock']);
                echo json_encode($row);
            } else {
                $stmt = $pdo->query("
                    SELECT p.*, s.name AS supplier_name
                    FROM products p
                    LEFT JOIN suppliers s ON s.id = p.supplier_id
                    ORDER BY p.id DESC");
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) $r['status'] = stockStatus((int)$r['stock']);
                echo json_encode($rows);
            }
            break;

        /* ---- CREATE ---- */
        case 'POST':
            $d = jsonBody();
            if (empty($d['sku']) || empty($d['name'])) {
                http_response_code(422);
                echo json_encode(['error' => 'sku and name are required']);
                break;
            }
            $stmt = $pdo->prepare("
                INSERT INTO products (sku, name, category, price, stock, supplier_id)
                VALUES (:sku, :name, :category, :price, :stock, :supplier_id)");
            $stmt->execute([
                'sku'         => trim($d['sku']),
                'name'        => trim($d['name']),
                'category'    => $d['category']    ?? '',
                'price'       => (float)($d['price']       ?? 0),
                'stock'       => (int)($d['stock']         ?? 0),
                'supplier_id' => (int)($d['supplier_id']   ?? 0),
            ]);
            $id = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'id' => $id, 'message' => 'Product created.']);
            break;

        /* ---- UPDATE ---- */
        case 'PUT':
            $d = jsonBody();
            if (empty($d['id'])) { http_response_code(422); echo json_encode(['error' => 'id required']); break; }
            $stmt = $pdo->prepare("
                UPDATE products
                SET sku=:sku, name=:name, category=:category,
                    price=:price, stock=:stock, supplier_id=:supplier_id
                WHERE id=:id");
            $stmt->execute([
                'id'          => (int)$d['id'],
                'sku'         => trim($d['sku']          ?? ''),
                'name'        => trim($d['name']         ?? ''),
                'category'    => $d['category']          ?? '',
                'price'       => (float)($d['price']     ?? 0),
                'stock'       => (int)($d['stock']       ?? 0),
                'supplier_id' => (int)($d['supplier_id'] ?? 0),
            ]);
            echo json_encode(['success' => true, 'message' => 'Product updated.']);
            break;

        /* ---- DELETE ---- */
        case 'DELETE':
            if (empty($_GET['id'])) { http_response_code(422); echo json_encode(['error' => 'id required']); break; }
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
            $stmt->execute([(int)$_GET['id']]);
            if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
            echo json_encode(['success' => true, 'message' => 'Product deleted.']);
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
