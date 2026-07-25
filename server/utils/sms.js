const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS notification to guardian
 * @param {string} phoneNumber - Guardian phone number (must be international format: +233XXXXXXXXX)
 * @param {string} studentName - Student's name
 * @param {string} destination - Exeat destination
 * @param {string} departureDate - Date leaving
 * @param {string} returnDate - Date returning
 */
async function sendApprovalSMS(phoneNumber, studentName, destination, departureDate, returnDate) {
  try {
    // Validate phone number format
    if (!phoneNumber) {
      console.error('❌ Phone number is empty');
      return { success: false, message: 'Phone number is empty' };
    }

    // Ensure international format
    let formattedPhone = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      console.warn('⚠️ Phone number missing +, converting...');
      // Convert 0XXXXXXXXX to +233XXXXXXXXX (Ghana)
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '+233' + phoneNumber.substring(1);
      } else {
        formattedPhone = '+' + phoneNumber;
      }
    }

    console.log(`📱 Sending SMS to: ${formattedPhone}`);
    console.log(`📝 Message: Approval notification for ${studentName}`);

    // Create message
    const message = await client.messages.create({
      body: `Hi, ${studentName}'s exeat request to ${destination} from ${departureDate} to ${returnDate} has been APPROVED. They will need this approval for their journey.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`✅ SMS sent successfully! SID: ${message.sid}`);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    console.error('Error code:', error.code);
    
    // Common Twilio errors
    if (error.code === 21211) {
      console.error('❌ Invalid phone number format. Use international format: +233XXXXXXXXX');
    } else if (error.code === 20003) {
      console.error('❌ Authentication error. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    } else if (error.code === 20005) {
      console.error('❌ Invalid Twilio phone number. Check TWILIO_PHONE_NUMBER');
    }

    return { 
      success: false, 
      message: error.message,
      errorCode: error.code
    };
  }
}

/**
 * Send rejection SMS
 */
async function sendRejectionSMS(phoneNumber, studentName, reason) {
  try {
    let formattedPhone = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '+233' + phoneNumber.substring(1);
      } else {
        formattedPhone = '+' + phoneNumber;
      }
    }

    console.log(`📱 Sending rejection SMS to: ${formattedPhone}`);

    const message = await client.messages.create({
      body: `Hi, ${studentName}'s exeat request has been REJECTED. Reason: ${reason}. Please contact your housemaster for more information.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`✅ Rejection SMS sent! SID: ${message.sid}`);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    return { 
      success: false, 
      message: error.message,
      errorCode: error.code
    };
  }
}

module.exports = {
  sendApprovalSMS,
  sendRejectionSMS
};
