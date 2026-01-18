
export const TELEGRAM_BOT_TOKEN = '8562240636:AAEFpo1WqanfPWmQezkei48BjgoLDu6jiKo';
export const TELEGRAM_GROUP_ID = '-4836248812';

export const sendTelegramMessage = async (text: string) => {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_GROUP_ID}&text=${encodedText}&parse_mode=HTML`;
    
    // Use no-cors mode to bypass CORS restrictions in the browser.
    // The request will be sent, but we won't get a readable response.
    // This avoids the preflight OPTIONS request which fails with Telegram API.
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
    });
    
    console.log('Telegram message sent (opaque response)');
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};
