import { useEffect } from 'react';

export const SolflareDeepLinkHandler = () => {
  useEffect(() => {
    const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const handleSolflareClick = (e: MouseEvent) => {
      // Only proceed if mobile
      if (!isMobile()) return;

      const target = e.target as HTMLElement;
      // Find the closest button if clicked on icon/text
      const button = target.closest('.wallet-adapter-button');
      
      if (!button) return;
      
      const buttonText = button.textContent?.toLowerCase();
      
      // Check if it's the Solflare button
      if (buttonText && buttonText.includes('solflare')) {
        // Check if Solflare is NOT injected (standard mobile browser)
        // @ts-ignore
        if (!window.solflare?.isSolflare) {
          e.preventDefault();
          e.stopPropagation();
          
          const currentUrl = encodeURIComponent(window.location.href);
          const ref = encodeURIComponent(window.location.origin);
          const deepLink = `https://solflare.com/ul/browse/${currentUrl}?ref=${ref}`;
          
          window.location.href = deepLink;
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const modal = document.querySelector('.wallet-adapter-modal');
          if (modal) {
            // Find all wallet buttons
            const buttons = modal.querySelectorAll('.wallet-adapter-button');
            buttons.forEach((btn) => {
              if (btn.textContent?.toLowerCase().includes('solflare')) {
                // Remove old listener to avoid duplicates (though capture phase handles it, cleaner to be safe)
                btn.removeEventListener('click', handleSolflareClick as any, true);
                // Add capture listener to intercept before React handles it
                btn.addEventListener('click', handleSolflareClick as any, true);
              }
            });
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
};
