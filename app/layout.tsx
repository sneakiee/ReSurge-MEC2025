import 'leaflet/dist/leaflet.css';
import './globals.css';
import Navbar from './components/navbar';
import ChatSidebar from './components/chat/sidebar';

export const metadata = {
  title: 'Interactive Map',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <div className="flex flex-col h-screen">
          <Navbar />
          <div className="flex-1 flex overflow-hidden">
            {/* left chat sidebar */}
            <ChatSidebar />

            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}