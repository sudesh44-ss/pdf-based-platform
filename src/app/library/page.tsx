'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Grid, List, Plus, FileX, SlidersHorizontal } from 'lucide-react';
import { storageEngine } from '@/lib/store/storageEngine';
import { Document } from '@/lib/types/database';
import { DocumentCard } from '@/components/library/DocumentCard';
import styles from './page.module.css';

export default function LibraryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'latest' | 'popular' | 'pages' | 'title'>('latest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const docs = storageEngine.getDocuments({ isPublic: true });
    setDocuments(docs);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => d.categories.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [documents]);

  const filteredDocs = useMemo(() => {
    let result = [...documents];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          (d.contributor_name && d.contributor_name.toLowerCase().includes(q))
      );
    }

    if (category !== 'all') {
      result = result.filter((d) => d.categories.includes(category));
    }

    result.sort((a, b) => {
      if (sort === 'popular') return b.likes_count - a.likes_count;
      if (sort === 'pages') return b.page_count - a.page_count;
      if (sort === 'title') return a.title.localeCompare(b.title);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [documents, search, category, sort]);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1>Public Technical Library</h1>
          <p>Explore curated, community-moderated computer science and engineering PDFs.</p>
        </div>

        <Link
          href="/my-contributions"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.15rem',
            background: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <Plus size={16} />
          <span>Submit PDF</span>
        </Link>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterControls}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Filter by title, tags, author..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.selectInput}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className={styles.selectInput}
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            aria-label="Sort order"
          >
            <option value="latest">Sort: Newest First</option>
            <option value="popular">Sort: Most Popular</option>
            <option value="pages">Sort: Most Pages</option>
            <option value="title">Sort: Alphabetical (A-Z)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredDocs.length} of {documents.length}
          </span>

          <div className={styles.viewToggle} role="group" aria-label="View layout">
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
              aria-label="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
              aria-label="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className={styles.emptyState}>
          <FileX size={44} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>No matching documents found</h2>
          <p className={styles.emptyText}>
            Try clearing your search query or choosing &quot;All Categories&quot; to discover more PDFs.
          </p>
          <button
            type="button"
            onClick={() => { setSearch(''); setCategory('all'); }}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? styles.grid : styles.list}>
          {filteredDocs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
