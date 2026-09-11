<?php
// branding.php — התאמת מיתוג (White-label)
// ---------------------------------------------------------------------------
// כל פריסה של האפליקציה יכולה להתאים את המראה שלה כאן, בלי לגעת ב-index.php.
// היקף ההתאמה: שם + לוגו + צבעים בלבד.
//
// אחרי עריכה — פשוט לרענן את הדף. אין צורך בכלי build.
// (הצבעים הסמנטיים — ירוק להצלחה, אדום לשגיאה — נשארים קבועים בכוונה.)
// ---------------------------------------------------------------------------

$brand = [
    // שם הארגון / האפליקציה. מוצג בכותרת הלשונית של הדפדפן.
    'name'     => 'המדריך הארגוני',

    // כותרת הלשונית בדפדפן. השאירו '' כדי ליפול חזרה ל-name.
    'title'    => 'חיפוש במדריך הארגוני',

    // כותרת המשנה מתחת ללוגו (שורת ההסבר לחיפוש). השאירו '' כדי להסתיר.
    'subtitle' => 'חיפוש לפי שם, קומה, תפקיד, עיר או מחלקה',

    // נתיב לתמונת הלוגו (יחסית לתיקיית האפליקציה). השאירו '' כדי להסתיר לוגו.
    'logo'     => 'images/logo.jpg',
    'logo_alt' => 'לוגו הארגון',

    // צבע המותג הראשי (כפתורים, כותרת הטבלה, עימוד). כל ערך צבע CSS תקין.
    'primary'    => '#0d6efd',

    // גוון כהה יותר למצבי hover/active. השאירו '' כדי לגזור אוטומטית מ-primary.
    'primary_dark' => '',

    // צבע הטקסט שמונח מעל צבע המותג (טקסט בכפתורים / בכותרת הטבלה).
    'on_primary' => '#ffffff',
];

/**
 * מכהה צבע hex באחוז נתון — משמש לגזירת גוון ה-hover כשלא הוגדר ידנית.
 * מקבל "#rgb" או "#rrggbb"; מחזיר "#rrggbb". קלט לא תקין מוחזר כמות שהוא.
 */
function brand_darken(string $hex, float $percent = 0.15): string {
    $hex = ltrim(trim($hex), '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
        return '#' . $hex; // לא hex — לא נוגעים
    }
    $factor = max(0.0, 1.0 - $percent);
    $r = (int) round(hexdec(substr($hex, 0, 2)) * $factor);
    $g = (int) round(hexdec(substr($hex, 2, 2)) * $factor);
    $b = (int) round(hexdec(substr($hex, 4, 2)) * $factor);
    return sprintf('#%02x%02x%02x', $r, $g, $b);
}

/**
 * בונה את בלוק ה-CSS שמחיל את צבעי המותג על רכיבי Bootstrap 5.3.
 * מוזרק ל-<head> של index.php.
 */
function brand_theme_css(array $brand): string {
    $primary   = $brand['primary'] ?: '#0d6efd';
    $onPrimary = $brand['on_primary'] ?: '#ffffff';
    $dark      = $brand['primary_dark'] !== '' ? $brand['primary_dark'] : brand_darken($primary, 0.15);

    // ערכי צבע נכנסים לתוך CSS — מסננים כדי שלא יישברו החוצה מהבלוק.
    $safe = static function (string $v): string {
        return preg_replace('/[^#a-zA-Z0-9(),.%\s]/', '', $v);
    };
    $primary   = $safe($primary);
    $onPrimary = $safe($onPrimary);
    $dark      = $safe($dark);

    return <<<CSS
    :root {
        --brand-primary: {$primary};
        --brand-primary-dark: {$dark};
        --brand-on-primary: {$onPrimary};
    }
    .btn-primary {
        --bs-btn-bg: var(--brand-primary);
        --bs-btn-border-color: var(--brand-primary);
        --bs-btn-color: var(--brand-on-primary);
        --bs-btn-hover-bg: var(--brand-primary-dark);
        --bs-btn-hover-border-color: var(--brand-primary-dark);
        --bs-btn-hover-color: var(--brand-on-primary);
        --bs-btn-active-bg: var(--brand-primary-dark);
        --bs-btn-active-border-color: var(--brand-primary-dark);
        --bs-btn-active-color: var(--brand-on-primary);
        --bs-btn-disabled-bg: var(--brand-primary);
        --bs-btn-disabled-border-color: var(--brand-primary);
        --bs-btn-disabled-color: var(--brand-on-primary);
    }
    .table-dark {
        --bs-table-bg: var(--brand-primary);
        --bs-table-color: var(--brand-on-primary);
        --bs-table-border-color: var(--brand-primary-dark);
    }
    .pagination {
        --bs-pagination-color: var(--brand-primary);
        --bs-pagination-hover-color: var(--brand-primary-dark);
        --bs-pagination-focus-color: var(--brand-primary-dark);
        --bs-pagination-active-bg: var(--brand-primary);
        --bs-pagination-active-border-color: var(--brand-primary);
    }
    CSS;
}
