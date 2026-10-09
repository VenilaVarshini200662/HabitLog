// public/js/email-service.js
// EmailJS integration for HabitLog

console.log('📧 email-service.js is loading...');

const EMAILJS_CONFIG = {
    serviceId: 'service_nfd0z7k',     // Your service ID
    templateId: 'template_z96h95v',    // Your template ID
    publicKey: 'xIRc9QJpgVdJ5KJ9I'     // Your public key
};

// Initialize EmailJS when the script loads
(function initEmailJS() {
    try {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_CONFIG.publicKey);
            console.log('✅ EmailJS initialized successfully');
        } else {
            console.error('❌ EmailJS library not loaded yet');
        }
    } catch (error) {
        console.error('❌ EmailJS initialization failed:', error);
    }
})();

// Send streak reminder email
async function sendStreakReminderEmail(userEmail, userName, habitName, streakNo) {
    console.log('📧 Sending email to:', userEmail, 'for habit:', habitName);
    
    try {
        // Check if emailjs is available
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS library not loaded');
        }
        
        // Template parameters matching your EmailJS template
        const templateParams = {
            email: userEmail,           // Your template uses {{email}}
            name: userName,              // Your template uses {{name}}
            habitName: habitName,        // Your template uses {{habitName}}
            streakNo: streakNo,          // Your template uses {{streakNo}}
            reply_to: 'munawarayed3136@gmail.com' // Your reply-to email
        };

        console.log('📤 Sending with params:', templateParams);

        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );

        console.log('✅ Email sent successfully:', response);
        return { success: true, response };
        
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { 
            success: false, 
            error: error.text || error.message || 'Unknown error'
        };
    }
}

// Test function
async function testEmailService(userEmail, userName) {
    console.log('🔍 Testing email service...');
    return await sendStreakReminderEmail(
        userEmail,
        userName,
        'Morning Run',  // Test habit name
        7               // Test streak number
    );
}

// Make functions globally available
window.emailService = {
    sendStreakReminderEmail: sendStreakReminderEmail,
    testEmailService: testEmailService
};

console.log('✅ window.emailService is now defined:', window.emailService);