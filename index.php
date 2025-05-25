<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/ldap_functions.php';

// פונקציה להמרת מספר טלפון ללינק תקני
function phoneHref($number) {
    $digits = preg_replace('/\D+/', '', $number);
    if (preg_match('/^05\d{8}$/', $digits)) {
        return 'tel:' . $digits;
    }
    if (preg_match('/^972\d+$/', $digits)) {
        return 'tel:+' . $digits;
    }
    if (preg_match('/^0\d{8,9}$/', $digits)) {
        return 'tel:' . $digits;
    }
    return 'tel:' . $digits;
}

// חיתוך שדות ארוכים להצגה בטבלה עם tooltip
function ellipsisCell($str) {
    $words = preg_split('/\s+/', $str);
    if (count($words) > 3) {
        $short = implode(' ', array_slice($words, 0, 3)) . '...';
        return '<span class="ellipsis-cell" title="' . htmlspecialchars($str) . '">' . htmlspecialchars($short) . '</span>';
    } else {
        return htmlspecialchars($str);
    }
}

// --- יצוא CSV ---
if (isset($_POST['export_csv'])) {
    $searchInput = trim($_POST['searchInput'] ?? '');
    $floorInput = trim($_POST['floorInput'] ?? '');
    $jobTitleFilter = trim($_POST['jobTitleFilter'] ?? '');
    $cityFilter = trim($_POST['cityFilter'] ?? '');
    $departmentFilter = trim($_POST['departmentFilter'] ?? '');

    $csvEntries = [];
    $ldap_conn = ldapConnectBind();
    if ($ldap_conn) {
        $entries = searchActiveDirectory($ldap_conn, $ldap_dn, $searchInput, $floorInput);
        closeLdapConnection($ldap_conn);
        if (!empty($entries) && isset($entries['count'])) {
            for ($i = 0; $i < $entries['count']; $i++) {
                $e = $entries[$i];
                $displayName = $e['displayname'][0] ?? '';
                $description = $e['description'][0] ?? '';
                $dn = $e['distinguishedname'][0] ?? '';
                $title = $e['title'][0] ?? '';
                $department = $e['department'][0] ?? '';
                $city = $e['l'][0] ?? '';
                $homephone = $e['homephone'][0] ?? '';
                $mobile = $e['mobile'][0] ?? '';
                $email = $e['mail'][0] ?? '';
                if (
                    empty($displayName) ||
                    stripos($displayName, 'zzz') === 0 ||
                    stripos($displayName, 'Admin') === 0
                ) continue;
                $nameMatches = false;
                $floorMatches = false;
                $titleMatches = false;
                $cityMatches = false;
                $deptMatches = false;
                if ($searchInput !== '') {
                    $needle = mb_strtolower($searchInput);
                    $given = mb_strtolower($e['givenname'][0] ?? '');
                    $descr = mb_strtolower($e['description'][0] ?? '');
                    if (strpos($given, $needle) === 0 || mb_strpos($descr, $needle) !== false)
                        $nameMatches = true;
                }
                if ($floorInput !== '') {
                    if (stripos($dn, "Floor $floorInput") !== false) $floorMatches = true;
                }
                if ($jobTitleFilter !== '') {
                    if ($title === $jobTitleFilter) $titleMatches = true;
                }
                if ($cityFilter !== '') {
                    if ($city === $cityFilter) $cityMatches = true;
                }
                if ($departmentFilter !== '') {
                    if ($department === $departmentFilter) $deptMatches = true;
                }
                if (
                    ($searchInput === '' && $floorInput === '' && $jobTitleFilter === '' && $cityFilter === '' && $departmentFilter === '') ||
                    $nameMatches || $floorMatches || $titleMatches || $cityMatches || $deptMatches
                ) {
                    preg_match_all('/OU=([^,]+)/', $e['distinguishedname'][0], $m);
                    $floor = 'N/A';
                    foreach ($m[1] as $ou) {
                        if (preg_match('/Floor (\d+)/', $ou, $fm)) {
                            $floor = $fm[1];
                            break;
                        }
                    }
                    // טלפונים בפורמט ש-Excel לא יפרש כמספר
                    $homephone_csv = preg_replace('/\D+/', '', $homephone);
                    $mobile_csv = preg_replace('/\D+/', '', $mobile);
                    if ($homephone_csv !== '') {
                        $homephone_csv = '="' . $homephone_csv . '"';
                    }
                    if ($mobile_csv !== '') {
                        $mobile_csv = '="' . $mobile_csv . '"';
                    }

                    $onlyDigits = preg_replace('/\D+/', '', $homephone);
                    $extension = (strlen($onlyDigits) >= 4)
                        ? substr($onlyDigits, -4)
                        : '';
                    $extensionDisplay = $extension;
                    if (
                        $homephone &&
                        strpos($homephone, '+972-2-') === 0 &&
                        strlen($extension) === 4 &&
                        $extension[0] === '9'
                    ) {
                        $extensionDisplay = '2' . substr($extension, 1);
                    }

                    $csvEntries[] = [
                        'שם בעברית'    => $description,
                        'שם באנגלית'    => $displayName,
                        'שלוחה'         => $extensionDisplay,
                        'טלפון'         => $homephone_csv,
                        'נייד'          => $mobile_csv,
                        'אימייל'        => $email,
                        'עיר'           => $city,
                        'תפקיד'         => $title,
                        'מחלקה'         => $department,
                        'קומה'          => $floor
                    ];
                }
            }
        }
    }
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename=directory_export_' . date('Ymd_His') . '.csv');
    echo "\xEF\xBB\xBF"; // BOM ל-UTF8
    $out = fopen('php://output', 'w');
    if (count($csvEntries) > 0) {
        fputcsv($out, array_keys($csvEntries[0]));
        foreach ($csvEntries as $row) {
            fputcsv($out, $row);
        }
    }
    fclose($out);
    exit;
}

// --- אתחול וסינון ---
$ldap_conn = ldapConnectBind();
$jobTitleCounts = [];
$cityCounts = [];
$departmentCounts = [];
if ($ldap_conn) {
    $allEntries = searchActiveDirectory($ldap_conn, $ldap_dn);
    if (!empty($allEntries) && isset($allEntries['count'])) {
        for ($i = 0; $i < $allEntries['count']; $i++) {
            $e = $allEntries[$i];
            $displayName = $e['displayname'][0] ?? '';
            if (
                empty($displayName) ||
                stripos($displayName, 'zzz') === 0 ||
                stripos($displayName, 'Admin') === 0
            ) continue;
            $t = $e['title'][0] ?? '';
            if ($t !== '') $jobTitleCounts[$t] = ($jobTitleCounts[$t] ?? 0) + 1;
            $c = $e['l'][0] ?? '';
            if ($c !== '') $cityCounts[$c] = ($cityCounts[$c] ?? 0) + 1;
            $d = $e['department'][0] ?? '';
            if ($d !== '') $departmentCounts[$d] = ($departmentCounts[$d] ?? 0) + 1;
        }
    }
    ksort($jobTitleCounts, SORT_STRING | SORT_FLAG_CASE);
    ksort($cityCounts, SORT_STRING | SORT_FLAG_CASE);
    ksort($departmentCounts, SORT_STRING | SORT_FLAG_CASE);
    closeLdapConnection($ldap_conn);
}
$jobTitles = array_keys($jobTitleCounts);
$cities = array_keys($cityCounts);
$departments = array_keys($departmentCounts);

$searchInput = '';
$floorInput = '';
$jobTitleFilter = '';
$cityFilter = '';
$departmentFilter = '';
$filteredEntries = [];
$errorMessage = '';
$resultsCount = 0;
$itemsPerPage = 20;
$currentPage = isset($_GET['page']) && is_numeric($_GET['page']) && $_GET['page'] > 0 ? (int)$_GET['page'] : 1;
$totalPages = 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['export_csv'])) {
    $currentPage = 1;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['page'])) {
    $searchInput = trim($_POST['searchInput'] ?? $_GET['searchInput'] ?? '');
    $floorInput = trim($_POST['floorInput'] ?? $_GET['floorInput'] ?? '');
    $jobTitleFilter = trim($_POST['jobTitleFilter'] ?? $_GET['jobTitleFilter'] ?? '');
    $cityFilter = trim($_POST['cityFilter'] ?? $_GET['cityFilter'] ?? '');
    $departmentFilter = trim($_POST['departmentFilter'] ?? $_GET['departmentFilter'] ?? '');

    if (
        $searchInput === '' &&
        $floorInput === '' &&
        $jobTitleFilter === '' &&
        $cityFilter === '' &&
        $departmentFilter === ''
    ) {
        $errorMessage = 'יש להזין לפחות שם, קומה, תפקיד, עיר או מחלקה לחיפוש.';
    } elseif ($searchInput !== '' && mb_strlen($searchInput) < 2) {
        $errorMessage = 'שם חייב להכיל לפחות 2 תווים.';
    }

    if ($errorMessage === '') {
        $ldap_conn = ldapConnectBind();
        if (!$ldap_conn) {
            $errorMessage = 'לא ניתן להתחבר ל־LDAP.';
        } else {
            $entries = searchActiveDirectory($ldap_conn, $ldap_dn, $searchInput, $floorInput);
            closeLdapConnection($ldap_conn);
            if (!empty($entries) && isset($entries['count'])) {
                for ($i = 0; $i < $entries['count']; $i++) {
                    $e = $entries[$i];
                    $displayName = $e['displayname'][0] ?? '';
                    $description = $e['description'][0] ?? '';
                    $dn = $e['distinguishedname'][0] ?? '';
                    $title = $e['title'][0] ?? '';
                    $department = $e['department'][0] ?? '';
                    $city = $e['l'][0] ?? '';
                    $homephone = $e['homephone'][0] ?? '';
                    $mobile = $e['mobile'][0] ?? '';
                    $email = $e['mail'][0] ?? '';
                    if (
                        empty($displayName) ||
                        stripos($displayName, 'zzz') === 0 ||
                        stripos($displayName, 'Admin') === 0
                    ) continue;
                    $nameMatches = false;
                    $floorMatches = false;
                    $titleMatches = false;
                    $cityMatches = false;
                    $deptMatches = false;
                    if ($searchInput !== '') {
                        $needle = mb_strtolower($searchInput);
                        $given = mb_strtolower($e['givenname'][0] ?? '');
                        $descr = mb_strtolower($e['description'][0] ?? '');
                        if (strpos($given, $needle) === 0 || mb_strpos($descr, $needle) !== false)
                            $nameMatches = true;
                    }
                    if ($floorInput !== '') {
                        if (stripos($dn, "Floor $floorInput") !== false) $floorMatches = true;
                    }
                    if ($jobTitleFilter !== '') {
                        if ($title === $jobTitleFilter) $titleMatches = true;
                    }
                    if ($cityFilter !== '') {
                        if ($city === $cityFilter) $cityMatches = true;
                    }
                    if ($departmentFilter !== '') {
                        if ($department === $departmentFilter) $deptMatches = true;
                    }
                    if (
                        ($searchInput === '' && $floorInput === '' && $jobTitleFilter === '' && $cityFilter === '' && $departmentFilter === '') ||
                        $nameMatches || $floorMatches || $titleMatches || $cityMatches || $deptMatches
                    ) {
                        $filteredEntries[] = $e;
                    }
                }
            }
        }
    }

    $resultsCount = count($filteredEntries);
    $totalPages = max(1, ceil($resultsCount / $itemsPerPage));
    if ($currentPage > $totalPages) $currentPage = $totalPages;
    $startIndex = ($currentPage - 1) * $itemsPerPage;
    $filteredEntries = array_slice($filteredEntries, $startIndex, $itemsPerPage);
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>חיפוש במדריך הארגוני</title>
    <link rel="stylesheet" href="css/bootstrap.min.css">
    <link rel="stylesheet" href="css/rtl.css">
    <link rel="stylesheet" href="css/custom-directory.css">
    <style>
    .ellipsis-cell {
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
        display: inline-block;
        vertical-align: bottom;
        direction: rtl;
    }
    .version-footer {
        color: #777;
        font-size: 0.95em;
        text-align: center;
        margin-top: 25px;
        margin-bottom: 12px;
    }
    </style>
</head>
<body class="bg-light" dir="rtl">
<div class="container">

    <div class="header-container">
        <img src="images/logo.jpg" alt="Company Logo" class="header-logo">
        <h2 class="mt-4">חיפוש לפי שם, קומה, תפקיד, עיר או מחלקה</h2>
    </div>

    <div class="search-form-center">
        <form method="POST" action="" class="my-4">
            <div class="search-form-inner">
                <div class="search-form-group">
                    <label for="searchInput">שם</label>
                    <input type="text" id="searchInput" name="searchInput"
                           class="form-control"
                           value="<?= htmlspecialchars($searchInput) ?>"
                           placeholder="לדוג': דור">
                </div>
                <div class="search-form-group">
                    <label for="floorInput">קומה</label>
                    <input type="text" id="floorInput" name="floorInput"
                           class="form-control"
                           value="<?= htmlspecialchars($floorInput) ?>"
                           placeholder="37">
                </div>
                <div class="search-form-group">
                    <label for="jobTitleFilter">תפקיד</label>
                    <select id="jobTitleFilter" name="jobTitleFilter" class="form-select">
                        <option value="">הכל</option>
                        <?php foreach ($jobTitles as $jt): ?>
                            <option value="<?= htmlspecialchars($jt) ?>" <?= ($jt == $jobTitleFilter ? 'selected' : '') ?>><?= htmlspecialchars($jt) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="search-form-group">
                    <label for="cityFilter">עיר</label>
                    <select id="cityFilter" name="cityFilter" class="form-select">
                        <option value="">הכל</option>
                        <?php foreach ($cities as $city): ?>
                            <option value="<?= htmlspecialchars($city) ?>" <?= ($city == $cityFilter ? 'selected' : '') ?>><?= htmlspecialchars($city) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="search-form-group">
                    <label for="departmentFilter">מחלקה</label>
                    <select id="departmentFilter" name="departmentFilter" class="form-select">
                        <option value="">הכל</option>
                        <?php foreach ($departments as $department): ?>
                            <option value="<?= htmlspecialchars($department) ?>" <?= ($department == $departmentFilter ? 'selected' : '') ?>><?= htmlspecialchars($department) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="search-form-group search-form-btn">
                    <button type="submit" class="btn btn-primary w-100">חיפוש</button>
                </div>
            </div>
        </form>
    </div>

    <?php if ($resultsCount > 10 && empty($errorMessage)): ?>
        <div class="d-flex justify-content-center mb-2">
            <form method="post" action="">
                <input type="hidden" name="searchInput" value="<?= htmlspecialchars($searchInput) ?>">
                <input type="hidden" name="floorInput" value="<?= htmlspecialchars($floorInput) ?>">
                <input type="hidden" name="jobTitleFilter" value="<?= htmlspecialchars($jobTitleFilter) ?>">
                <input type="hidden" name="cityFilter" value="<?= htmlspecialchars($cityFilter) ?>">
                <input type="hidden" name="departmentFilter" value="<?= htmlspecialchars($departmentFilter) ?>">
                <button type="submit" name="export_csv" class="btn btn-success">יצא ל-CSV</button>
            </form>
        </div>
    <?php endif; ?>

    <div class="d-flex justify-content-center">
        <div style="width:100%;max-width:100%;">
            <?php if (!empty($errorMessage)): ?>
                <div class="alert alert-danger mt-3 text-center"><?= $errorMessage ?></div>
            <?php endif; ?>

            <?php if (($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['page'])) && empty($errorMessage)): ?>
                <?php if ($resultsCount > 0): ?>
                    <div class="table-center-wrap">
                        <div class="table-center-inner">
                            <div class="table-responsive" style="max-width: 100vw;">
                                <table class="table table-striped table-bordered no-wrap-table mt-4">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>שם בעברית</th>
                                            <th>שם באנגלית</th>
                                            <th>שלוחה</th>
                                            <th>טלפון</th>
                                            <th>נייד</th>
                                            <th>אימייל</th>
                                            <th>עיר</th>
                                            <th>תפקיד</th>
                                            <th>מחלקה</th>
                                            <th>קומה</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    <?php foreach ($filteredEntries as $e):
                                        $displayName = $e['displayname'][0] ?? '';
                                        $description = $e['description'][0] ?? '';
                                        $homephone   = $e['homephone'][0] ?? '';
                                        $mobile      = $e['mobile'][0] ?? '';
                                        $email       = $e['mail'][0] ?? '';
                                        $city        = $e['l'][0] ?? '';
                                        $title       = $e['title'][0] ?? '';
                                        $department  = $e['department'][0] ?? '';
                                        preg_match_all('/OU=([^,]+)/', $e['distinguishedname'][0], $m);
                                        $floor = 'N/A';
                                        foreach ($m[1] as $ou) {
                                            if (preg_match('/Floor (\d+)/', $ou, $fm)) {
                                                $floor = $fm[1];
                                                break;
                                            }
                                        }
                                        $onlyDigits = preg_replace('/\D+/', '', $homephone);
                                        $extension = (strlen($onlyDigits) >= 4)
                                            ? substr($onlyDigits, -4)
                                            : '';
                                        $extensionDisplay = $extension;
                                        if (
                                            $homephone &&
                                            strpos($homephone, '+972-2-') === 0 &&
                                            strlen($extension) === 4 &&
                                            $extension[0] === '9'
                                        ) {
                                            $extensionDisplay = '2' . substr($extension, 1);
                                        }
                                    ?>
                                        <tr>
                                            <td><?= htmlspecialchars($description) ?></td>
                                            <td><?= htmlspecialchars($displayName) ?></td>
                                            <td style="direction:ltr;text-align:center;">
                                                <?php if ($extension): ?>
                                                    <a href="tel:<?= htmlspecialchars($onlyDigits) ?>">
                                                        <?= htmlspecialchars($extensionDisplay) ?>
                                                    </a>
                                                <?php endif; ?>
                                            </td>
                                            <td style="direction:ltr;text-align:center;">
                                                <?php if ($homephone): ?>
                                                    <a href="<?= phoneHref($homephone) ?>">
                                                        <?= htmlspecialchars($homephone) ?>
                                                    </a>
                                                <?php endif; ?>
                                            </td>
                                            <td style="direction:ltr;text-align:center;">
                                                <?php if ($mobile): ?>
                                                    <a href="<?= phoneHref($mobile) ?>">
                                                        <?= htmlspecialchars($mobile) ?>
                                                    </a>
                                                <?php endif; ?>
                                            </td>
                                            <td><?= htmlspecialchars($email) ?></td>
                                            <td><?= htmlspecialchars($city) ?></td>
                                            <td><?= ellipsisCell($title) ?></td>
                                            <td><?= ellipsisCell($department) ?></td>
                                            <td><?= htmlspecialchars($floor) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                <?php else: ?>
                    <div class="alert alert-warning mt-4 text-center">לא נמצאו תוצאות.</div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
    </div>

    <?php if (($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['page'])) && empty($errorMessage) && $resultsCount > 0): ?>
        <div class="d-flex flex-column align-items-center my-4">
            <div class="text-center mb-2" style="font-size:1.08em;">
                נמצאו <b><?= $resultsCount ?></b> תוצאות
                <?php if ($totalPages > 1): ?>
                    (<?= $totalPages ?> עמודים)
                <?php endif; ?>
            </div>
            <?php if ($totalPages > 1): ?>
                <nav>
                    <ul class="pagination mt-1 mb-0">
                        <?php
                        $baseUrl = strtok($_SERVER['REQUEST_URI'], '?');
                        $filterParams = [
                            'searchInput' => $searchInput,
                            'floorInput' => $floorInput,
                            'jobTitleFilter' => $jobTitleFilter,
                            'cityFilter' => $cityFilter,
                            'departmentFilter' => $departmentFilter
                        ];
                        $filterStr = http_build_query($filterParams);
                        ?>
                        <?php if ($currentPage > 1): ?>
                            <li class="page-item">
                                <a class="page-link" href="<?= $baseUrl ?>?<?= $filterStr ?>&page=<?= $currentPage - 1 ?>" aria-label="הקודם">&laquo;</a>
                            </li>
                        <?php endif; ?>
                        <?php
                        $range = 2;
                        $start = max(1, $currentPage - $range);
                        $end = min($totalPages, $currentPage + $range);
                        if ($start > 1) {
                            echo '<li class="page-item"><a class="page-link" href="' . $baseUrl . '?' . $filterStr . '&page=1">1</a></li>';
                            if ($start > 2) echo '<li class="page-item disabled"><span class="page-link">...</span></li>';
                        }
                        for ($p = $start; $p <= $end; $p++) {
                            $active = $p == $currentPage ? 'active' : '';
                            echo '<li class="page-item ' . $active . '"><a class="page-link" href="' . $baseUrl . '?' . $filterStr . '&page=' . $p . '">' . $p . '</a></li>';
                        }
                        if ($end < $totalPages) {
                            if ($end < $totalPages - 1) echo '<li class="page-item disabled"><span class="page-link">...</span></li>';
                            echo '<li class="page-item"><a class="page-link" href="' . $baseUrl . '?' . $filterStr . '&page=' . $totalPages . '">' . $totalPages . '</a></li>';
                        }
                        ?>
                        <?php if ($currentPage < $totalPages): ?>
                            <li class="page-item">
                                <a class="page-link" href="<?= $baseUrl ?>?<?= $filterStr ?>&page=<?= $currentPage + 1 ?>" aria-label="הבא">&raquo;</a>
                            </li>
                        <?php endif; ?>
                    </ul>
                </nav>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <div class="version-footer">
        גרסה 1.16 | 25.5.2025
    </div>
</div>
<script src="js/bootstrap.bundle.min.js"></script>
</body>
</html>
