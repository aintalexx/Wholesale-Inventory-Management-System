<?php
/* =============================================
   api/suppliers.php
   GET    /api/suppliers.php          → list all
   GET    /api/suppliers.php?id=1     → single supplier
   POST   /api/suppliers.php          → create { name, contact, email, category }
   PUT    /api/suppliers.php          → update { id, name, contact, email, category, status }
   DELETE /api/suppliers.php?id=1     → delete
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
                $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
                $stmt->execute([(int)$_GET['id']]);
                $row = $stmt->fetch();
                if (!$row) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
                echo json_encode($row);
            } else {
                $stmt = $pdo->query("SELECT * FROM suppliers ORDER BY id DESC");
                echo json_encode($stmt->fetchAll());
            }
            break;

        /* ---- CREATE ---- */
        case 'POST':
            $d = jsonBody();
            if (empty($d['name'])) {
                http_response_code(422);
                echo json_encode(['error' => 'name is required']);
                break;
            }
            $stmt = $pdo->prepare("
                INSERT INTO suppliers (name, contact, email, category, status)
                VALUES (:name, :contact, :email, :category, 'Active')");
            $stmt->execute([
                'name'     => trim($d['name']),
                'contact'  => trim($d['contact']  ?? ''),
                'email'    => trim($d['email']     ?? ''),
                'category' => $d['category']       ?? '',
            ]);
            $id = (int)$pdo->lastInsertId();
            echo json_encode(['success' => true, 'id' => $id, 'message' => 'Supplier created.']);
            break;

        /* ---- UPDATE ---- */
        case 'PUT':
            $d = jsonBody();
            if (empty($d['id'])) { http_response_code(422); echo json_encode(['error' => 'id required']); break; }
            $stmt = $pdo->prepare("
                UPDATE suppliers
                SET name=:name, contact=:contact, email=:email,
                    category=:category, status=:status
                WHERE id=:id");
            $stmt->execute([
                'id'       => (int)$d['id'],
                'name'     => trim($d['name']     ?? ''),
                'contact'  => trim($d['contact']  ?? ''),
                'email'    => trim($d['email']     ?? ''),
                'category' => $d['category']       ?? '',
                'status'   => $d['status']          ?? 'Active',
            ]);
            echo json_encode(['success' => true, 'message' => 'Supplier updated.']);
            break;

        /* ---- DELETE ---- */
        case 'DELETE':
            if (empty($_GET['id'])) { http_response_code(422); echo json_encode(['error' => 'id required']); break; }
            $stmt = $pdo->prepare("DELETE FROM suppliers WHERE id = ?");
            $stmt->execute([(int)$_GET['id']]);
            if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['error' => 'Not found']); break; }
            echo json_encode(['success' => true, 'message' => 'Supplier deleted.']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    // Foreign key constraint: supplier has linked products
    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['error' => 'Cannot delete: supplier has linked products.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>
