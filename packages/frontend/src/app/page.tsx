export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header - Placeholder */}
      <header className="h-14 border-b border-gray-200 flex items-center px-4">
        <h1 className="text-xl font-bold">MD2slide</h1>
        <div className="ml-auto flex gap-4">
          {/* TODO: Export buttons will be implemented later */}
          <button
            className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded"
            disabled
          >
            Export to Google Slides
          </button>
          <button
            className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded"
            disabled
          >
            Export to PDF
          </button>
        </div>
      </header>

      {/* Main content area - Editor and Preview split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel - Placeholder */}
        <section
          className="w-1/2 border-r border-gray-200 flex flex-col"
          aria-label="Markdown Editor"
        >
          <div className="h-10 border-b border-gray-200 flex items-center px-4 bg-gray-50">
            <span className="text-sm font-medium text-gray-600">Editor</span>
          </div>
          <div className="flex-1 p-4 bg-white">
            {/* TODO: CodeMirror editor will be implemented later */}
            <div className="w-full h-full border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
              <p>CodeMirror Editor - Coming Soon</p>
            </div>
          </div>
        </section>

        {/* Preview Panel - Placeholder */}
        <section
          className="w-1/2 flex flex-col"
          aria-label="Slide Preview"
        >
          <div className="h-10 border-b border-gray-200 flex items-center px-4 bg-gray-50">
            <span className="text-sm font-medium text-gray-600">Preview</span>
          </div>
          <div className="flex-1 p-4 bg-gray-100">
            {/* TODO: Marp preview iframe will be implemented later */}
            <div className="slide-preview-container h-full">
              <div className="slide-preview rounded flex items-center justify-center text-gray-400">
                <p>Slide Preview - Coming Soon</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Status bar - Placeholder */}
      <footer className="h-6 border-t border-gray-200 flex items-center px-4 text-xs text-gray-500 bg-gray-50">
        <span>Ready</span>
        <span className="ml-auto">Slide 1 of 1</span>
      </footer>
    </main>
  );
}
