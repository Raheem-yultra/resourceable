import TabNavbar from "@/components/ui/tab-navbar";

export default function NavbarDemo() {
  return (
    <div className="min-h-screen">
      <TabNavbar />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Navigation Menu Demo</h1>
            <p className="text-xl text-muted-foreground">
              This is a demonstration of the new Tab Navbar component integrated into ResourceAble
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Dropdown Navigation</h3>
              <p className="text-sm text-muted-foreground">
                Hover over "Services" to see a dropdown menu with service categories
              </p>
            </div>
            
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Search Integration</h3>
              <p className="text-sm text-muted-foreground">
                Quick search bar in the navbar for desktop users
              </p>
            </div>
            
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Responsive Design</h3>
              <p className="text-sm text-muted-foreground">
                Mobile-friendly navigation with collapsible menu
              </p>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Features</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>✅ Shadcn UI components</li>
              <li>✅ Tailwind CSS styling</li>
              <li>✅ TypeScript support</li>
              <li>✅ Radix UI primitives for accessibility</li>
              <li>✅ Integrated with your existing ResourceAble brand</li>
              <li>✅ Links to Search, Browse, and About pages</li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-3">How to Use</h2>
            <div className="space-y-3 text-sm">
              <p>
                <strong>To replace your existing navbar:</strong> Update <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">components/layout/Navbar.tsx</code> to use the TabNavbar component instead.
              </p>
              <p>
                <strong>To customize links:</strong> Edit the menu items in <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">components/ui/tab-navbar.tsx</code>
              </p>
              <p>
                <strong>To add more dropdowns:</strong> Copy the NavigationMenuItem structure and add your own categories
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
