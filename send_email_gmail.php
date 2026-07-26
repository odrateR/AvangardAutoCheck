<?php
/**
 * PHPMailer - Configurare Email pentru Gmail SMTP
 * Trimite email-uri reale prin contul tău de Gmail
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Încarcă PHPMailer
require 'vendor/autoload.php';

// Setări pentru prevenirea erorilor de cross-origin
header('Content-Type: application/json; charset=utf-8');

// Verifică dacă cererea este POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // Preia și sanitizează datele din formular
    $name = isset($_POST['name']) ? strip_tags(trim($_POST['name'])) : '';
    $email = isset($_POST['email']) ? filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL) : '';
    $phone = isset($_POST['phone']) ? strip_tags(trim($_POST['phone'])) : '';
    $service = isset($_POST['service']) ? strip_tags(trim($_POST['service'])) : '';
    $message = isset($_POST['message']) ? strip_tags(trim($_POST['message'])) : '';
    
    // Validează datele
    if (empty($name) || empty($email) || empty($phone)) {
        echo json_encode(['success' => false, 'message' => 'Te rugăm să completezi toate câmpurile obligatorii.']);
        exit;
    }
    
    // Validează formatul email-ului
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Te rugăm să introduci o adresă de email validă.']);
        exit;
    }
    
    // ============================================
    // CONFIGURARE GMAIL - COMPLETEAZĂ AICI
    // ============================================
    
    $gmail_user = 'avangardautocheck@gmail.com';  // Email-ul tău de Gmail
    $gmail_password = 'nlri wicd wgfn epvj';  // App Password de la Google (vezi instrucțiunile mai jos)
    $recipient_email = 'avangardautocheck@gmail.com';  // Unde vrei să primești email-urile
    
    // ============================================
    
    // Creează instanță PHPMailer
    $mail = new PHPMailer(true);
    
    try {
        // Setări Server SMTP
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $gmail_user;
        $mail->Password   = $gmail_password;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';
        
        // Destinatari
        $mail->setFrom($gmail_user, 'Avangard Autocheck Website');
        $mail->addAddress($recipient_email, 'Avangard Autocheck');
        $mail->addReplyTo($email, $name);
        
        // Conținut email
        $mail->isHTML(true);
        $mail->Subject = "Cerere Nouă de Inspecție - " . $service;
        
        // Construiește conținutul email-ului în format HTML
        $mail->Body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1E88E5 0%, #4CAF50 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h2 { margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
                .field { margin-bottom: 25px; }
                .label { font-weight: bold; color: #1E88E5; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; }
                .value { background: white; padding: 15px; border-left: 4px solid #4CAF50; font-size: 16px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; color: #666; font-size: 12px; }
                .urgent { background: #fff3cd; border-left-color: #ff9800; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h2>📧 Cerere Nouă de Inspecție Auto</h2>
                    <p style='margin: 10px 0 0; font-size: 14px;'>Mesaj primit de pe website</p>
                </div>
                <div class='content'>
                    <div class='field'>
                        <div class='label'>👤 Nume Client</div>
                        <div class='value'><strong>" . htmlspecialchars($name) . "</strong></div>
                    </div>
                    
                    <div class='field'>
                        <div class='label'>📧 Email</div>
                        <div class='value'><a href='mailto:" . htmlspecialchars($email) . "' style='color: #1E88E5; text-decoration: none;'>" . htmlspecialchars($email) . "</a></div>
                    </div>
                    
                    <div class='field'>
                        <div class='label'>📱 Telefon</div>
                        <div class='value'><a href='tel:" . htmlspecialchars($phone) . "' style='color: #1E88E5; text-decoration: none;'>" . htmlspecialchars($phone) . "</a></div>
                    </div>
                    
                    <div class='field'>
                        <div class='label'>🔧 Serviciu Dorit</div>
                        <div class='value " . ($service == 'Inspecție Urgentă' ? 'urgent' : '') . "'><strong>" . htmlspecialchars($service) . "</strong></div>
                    </div>
                    
                    <div class='field'>
                        <div class='label'>💬 Mesaj</div>
                        <div class='value'>" . nl2br(htmlspecialchars($message)) . "</div>
                    </div>
                    
                    <div class='footer'>
                        <p><strong>Acest email a fost trimis automat de pe site-ul Avangard Autocheck</strong></p>
                        <p>Data: " . date('d/m/Y H:i:s') . "</p>
                        <p style='margin-top: 15px;'>Pentru a răspunde clientului, apasă Reply sau contactează-l direct la:</p>
                        <p><a href='mailto:" . htmlspecialchars($email) . "' style='color: #1E88E5;'>" . htmlspecialchars($email) . "</a> | <a href='tel:" . htmlspecialchars($phone) . "' style='color: #4CAF50;'>" . htmlspecialchars($phone) . "</a></p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        ";
        
        // Versiune text simplu (fallback)
        $mail->AltBody = "Cerere Nouă de Inspecție Auto\n\n" .
                        "Nume: $name\n" .
                        "Email: $email\n" .
                        "Telefon: $phone\n" .
                        "Serviciu: $service\n\n" .
                        "Mesaj:\n$message\n\n" .
                        "Data: " . date('d/m/Y H:i:s');
        
        // Trimite email-ul
        $mail->send();
        
        // Email trimis cu succes
        echo json_encode([
            'success' => true, 
            'message' => 'Mesajul a fost trimis cu succes! Vă vom contacta în curând.'
        ]);
        
    } catch (Exception $e) {
        // Eroare la trimiterea email-ului
        echo json_encode([
            'success' => false, 
            'message' => 'A apărut o eroare la trimiterea mesajului. Te rugăm să ne contactezi direct. Eroare: ' . $mail->ErrorInfo
        ]);
    }
    
} else {
    // Cerere invalidă
    echo json_encode(['success' => false, 'message' => 'Cerere invalidă.']);
}
?>
