<?php
// includes/ldap_functions.php

require_once __DIR__ . '/../config.php';

/**
 * התחברות + Bind לשרת LDAP
 */
function ldapConnectBind() {
    global $ldap_host, $ldap_user, $ldap_pass;
    $conn = @ldap_connect($ldap_host);
    if (!$conn) {
        return false;
    }
    ldap_set_option($conn, LDAP_OPT_PROTOCOL_VERSION, 3);
    ldap_set_option($conn, LDAP_OPT_REFERRALS, 0);
    $bind = @ldap_bind($conn, $ldap_user, $ldap_pass);
    if (!$bind) {
        return false;
    }
    return $conn;
}

/**
 * חיפוש Active Directory לפי קלט (שם או קומה)
 */
function searchActiveDirectory($ldap_conn, $ldap_dn, $searchInput = '', $floorInput = '') {
    if (empty($searchInput)) {
        $search_filter = "(objectCategory=person)";
    } else {
        $search_filter = "(|(givenName=$searchInput*)(description=*$searchInput*))";
    }

    $attributes = [
        "displayName",
        "description",
        "homephone",
        "telephonenumber",
        "mobile",
        "mail",
        "l",
        "title",
        "department",   // חשוב!
        "distinguishedName"
    ];

    $result = @ldap_search($ldap_conn, $ldap_dn, $search_filter, $attributes);
    if (!$result) {
        return [];
    }
    $entries = @ldap_get_entries($ldap_conn, $result);
    if ($entries === false || $entries["count"] == 0) {
        return [];
    }
    return $entries;
}

/**
 * סגירת החיבור ל-LDAP
 */
function closeLdapConnection($ldap_conn) {
    @ldap_unbind($ldap_conn);
}
