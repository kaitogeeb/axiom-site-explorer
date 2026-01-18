import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const TransactionPreview = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateImage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: "Generate a realistic mockup of a Phantom wallet transaction approval screen showing an atomic token swap. The screen should display: \n\n1. Phantom wallet header with purple gradient\n2. Transaction title 'Approve Transaction'\n3. Two transaction items:\n   - First item: '-1 SOL' in red with SOL icon, labeled 'Transfer'\n   - Second item: '+1,000 TOKENS' in green with a coin icon, labeled 'Receive'\n4. Total changes summary showing '-1 SOL' and '+1,000 TOKENS'\n5. Network fee showing '0.000005 SOL'\n6. Two buttons at bottom: 'Reject' (gray) and 'Approve' (purple gradient)\n7. Professional mobile wallet UI design with dark theme\n8. Show the transaction is a single atomic swap\n\nMake it look exactly like a real Phantom wallet transaction approval screen with accurate Solana wallet styling."
            }
          ],
          modalities: ["image", "text"]
        })
      });

      const data = await response.json();
      const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (generatedImageUrl) {
        setImageUrl(generatedImageUrl);
      }
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Token Sale Transaction Preview</h2>
          <p className="text-muted-foreground">
            See exactly how the transaction will appear in your wallet
          </p>
        </div>

        {!imageUrl && (
          <Button 
            onClick={generateImage} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Generating Preview..." : "Show Transaction Preview"}
          </Button>
        )}

        {imageUrl && (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border">
              <img 
                src={imageUrl} 
                alt="Wallet transaction preview" 
                className="w-full h-auto"
              />
            </div>
            
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <h3 className="font-semibold">What the user sees:</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><span className="text-destructive">-1 SOL</span> being sent to your wallet</li>
                <li><span className="text-green-500">+1,000 TOKENS</span> being received from your wallet</li>
                <li>Single transaction to approve (atomic swap)</li>
                <li>Small network fee (~0.000005 SOL)</li>
                <li>Both transfers happen together or not at all</li>
              </ul>
            </div>

            <Button 
              onClick={() => {
                setImageUrl(null);
                generateImage();
              }} 
              variant="outline"
              className="w-full"
            >
              Regenerate Preview
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
