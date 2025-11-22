<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin', '*');
header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
header('Access-Control-Allow-Headers', 'Content-Type');

// Simple disposable domain list
$DISPOSABLE_DOMAINS = array(
    'mailinator.com',
    '10minutemail.com',
    'guerrillamail.com',
    'yopmail.com',
    'tempmail.com',
    'temp-mail.org',
    'throwawaymail.com',
    'moakt.com',
    'trashmail.com'
);

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function normalize_email_php($email) {
    $email = trim($email);
    $pos = strrpos($email, '@');
    if ($pos === false) {
        return array(null, null, null);
    }
    $local = substr($email, 0, $pos);
    $domain = strtolower(substr($email, $pos + 1));
    $normalized = $local . '@' . $domain;
    return array($normalized, $local, $domain);
}

function smtp_check_php($normalized_email, $hosts, $timeout = 7) {
    $deliverable = null;
    $smtp_connectable = false;
    $rcpt_code = null;
    $reason = null;
    $from = 'verify@example.com';
    $helo = 'example.com';

    if (!function_exists('stream_socket_client')) {
        return array(null, false, null, 'smtp_unavailable');
    }

    foreach ($hosts as $host) {
        $errno = 0;
        $errstr = '';
        $fp = @stream_socket_client('tcp://' . $host . ':25', $errno, $errstr, $timeout);
        if (!$fp) {
            continue;
        }
        $smtp_connectable = true;
        stream_set_timeout($fp, $timeout);

        $banner = fgets($fp, 512);
        if ($banner === false) {
            fclose($fp);
            continue;
        }

        fwrite($fp, "EHLO " . $helo . "\r\n");
        // Consume a few EHLO lines
        for ($i = 0; $i < 4; $i++) {
            $line = fgets($fp, 512);
            if ($line === false) {
                break;
            }
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }

        fwrite($fp, "MAIL FROM:<" . $from . ">\r\n");
        $mailResp = fgets($fp, 512);

        fwrite($fp, "RCPT TO:<" . $normalized_email . ">\r\n");
        $rcptResp = fgets($fp, 512);

        fwrite($fp, "QUIT\r\n");
        fclose($fp);

        if ($rcptResp !== false && preg_match('/^(\d{3})/', $rcptResp, $m)) {
            $rcpt_code = intval($m[1]);
            if ($rcpt_code === 250 || $rcpt_code === 251) {
                $deliverable = true;
                break;
            }
            if (in_array($rcpt_code, array(550, 551, 552, 553, 554), true)) {
                $deliverable = false;
                break;
            }
            if (in_array($rcpt_code, array(450, 451, 452, 421), true)) {
                $deliverable = null;
                $reason = 'temp_' . $rcpt_code;
            }
        }
    }

    if (!$smtp_connectable && $deliverable === null && $reason === null) {
        $reason = 'smtp_unreachable';
    }

    return array($deliverable, $smtp_connectable, $rcpt_code, $reason);
}

function validate_single_email($email) {
    global $DISPOSABLE_DOMAINS;

    $result = array(
        'email' => $email,
        'normalized_email' => null,
        'domain' => null,
        'is_valid_syntax' => false,
        'domain_has_mx' => false,
        'smtp_connectable' => false,
        'is_deliverable' => null,
        'is_catch_all' => null,
        'is_disposable' => null,
        'status' => 'unknown',
        'reason' => null,
        'mx_hosts' => array()
    );

    list($normalized, $local, $domain) = normalize_email_php($email);
    if ($normalized === null) {
        $result['status'] = 'invalid_syntax';
        $result['reason'] = 'missing_at';
        $result['is_deliverable'] = false;
        return $result;
    }

    $result['normalized_email'] = $normalized;
    $result['domain'] = $domain;

    if (!filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
        $result['status'] = 'invalid_syntax';
        $result['reason'] = 'invalid_format';
        $result['is_deliverable'] = false;
        return $result;
    }

    $result['is_valid_syntax'] = true;

    $mxHosts = array();
    $hasMx = getmxrr($domain, $mxHosts);
    if (!$hasMx || count($mxHosts) === 0) {
        // Fallback to A record
        if (function_exists('checkdnsrr') && checkdnsrr($domain, 'A')) {
            $mxHosts = array($domain);
        } else {
            $result['status'] = 'invalid_domain';
            $result['reason'] = 'no_mx_no_a';
            $result['is_deliverable'] = false;
            return $result;
        }
    }
    $result['domain_has_mx'] = $hasMx;
    $result['mx_hosts'] = $mxHosts;

    list($deliverable, $smtp_connectable, $rcpt_code, $smtp_reason) = smtp_check_php($normalized, $mxHosts);
    $result['smtp_connectable'] = $smtp_connectable;
    $result['is_deliverable'] = $deliverable;

    // Hostinger shared hosting often blocks outbound SMTP.
    // If we can't reach SMTP but syntax + DNS look good,
    // treat as "assumed deliverable" based on MX only.
    if (!$smtp_connectable && $deliverable === null) {
        $result['status'] = 'deliverable';
        $result['reason'] = $smtp_reason !== null ? $smtp_reason : 'assumed_deliverable_no_smtp';
        $result['is_deliverable'] = true;
    } elseif ($deliverable === true) {
        $result['status'] = 'deliverable';
    } elseif ($deliverable === false) {
        $result['status'] = 'undeliverable';
        $result['reason'] = $rcpt_code !== null ? 'rcpt_' . $rcpt_code : 'hard_fail';
    } else {
        $result['status'] = 'unknown';
        $result['reason'] = $rcpt_code !== null ? 'rcpt_' . $rcpt_code : ($smtp_reason !== null ? $smtp_reason : 'temp_fail');
    }

    $result['is_disposable'] = in_array($domain, $DISPOSABLE_DOMAINS, true);

    return $result;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(array('error' => 'invalid_json'));
        exit;
    }

    $emails = isset($payload['emails']) && is_array($payload['emails']) ? $payload['emails'] : null;
    if ($emails === null) {
        http_response_code(400);
        echo json_encode(array('error' => 'invalid_emails'));
        exit;
    }

    $normalized = array();
    foreach ($emails as $e) {
        if (!is_string($e)) {
            continue;
        }
        $t = trim($e);
        if ($t === '' || strpos($t, '#') === 0) {
            continue;
        }
        $normalized[] = $t;
    }

    if (count($normalized) === 0) {
        http_response_code(400);
        echo json_encode(array('error' => 'no_emails'));
        exit;
    }

    $results = array();
    $counts = array('deliverable' => 0, 'undeliverable' => 0, 'unknown' => 0, 'invalid' => 0);

    foreach ($normalized as $addr) {
        $res = validate_single_email($addr);
        $status = $res['status'];
        if ($status === 'deliverable') {
            $counts['deliverable']++;
        } elseif ($status === 'undeliverable') {
            $counts['undeliverable']++;
        } elseif ($status === 'invalid_syntax' || $status === 'invalid_domain') {
            $counts['invalid']++;
        } else {
            $counts['unknown']++;
        }
        $res['ok'] = ($status === 'deliverable');
        $results[] = $res;
    }

    http_response_code(200);
    echo json_encode(array('results' => $results, 'summary' => $counts, 'total' => count($normalized)));
    exit;
}

$email = isset($_GET['email']) ? $_GET['email'] : null;
if (!$email) {
    http_response_code(400);
    echo json_encode(array('error' => 'missing_email'));
    exit;
}

$res = validate_single_email($email);
$status = $res['status'];
$res['ok'] = ($status === 'deliverable');

if ($status === 'deliverable') {
    http_response_code(200);
} elseif ($status === 'invalid_syntax' || $status === 'invalid_domain') {
    http_response_code(400);
} elseif ($status === 'undeliverable') {
    http_response_code(404);
} else {
    http_response_code(202);
}

echo json_encode($res);
