'use client';

import { useState } from 'react';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  distance: number;
}

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, topK: 5, tableName: 'search_test' }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }
      
      const data = await response.json();
      setResults(data.results);
    } catch (err: any) {
      setError(err.message || 'An error occurred during search');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索キーワードを入力..."
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">検索結果</h2>
          {results.map((result) => (
            <div key={result.id} className="border border-gray-200 p-4 rounded">
              <h3 className="text-lg font-medium">{result.title}</h3>
              <p className="text-sm text-gray-500">ID: {result.id} | 距離: {result.distance.toFixed(4)}</p>
              <p className="mt-2">{result.content}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && query && (
        <p className="text-gray-500">検索結果がありません。</p>
      )}
    </div>
  );
}
