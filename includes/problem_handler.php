<?php

/**
 * בודק שהמשתמש הקליד משהו באחד השדות:
 * - אם שני השדות ריקים => "נא להקליד שם או קומה..."
 * - אם השדה שם מלא אך פחות מ-2 תווים => "יש להקליד לפחות 2 תווים..."
 * - אחרת => אין שגיאה
 */
function checkSearchAndFloor($searchInput, $floorInput) {
    // אם גם $searchInput ריק וגם $floorInput ריק
    if (empty($searchInput) && empty($floorInput)) {
        return "נא להקליד שם (לפחות 2 תווים) או קומה לחיפוש.";
    }

    // אם השם לא ריק אבל פחות מ-2 תווים
    if (!empty($searchInput) && mb_strlen($searchInput) < 2) {
        return "יש להקליד לפחות 2 תווים בשדה החיפוש.";
    }

    return "";
}
