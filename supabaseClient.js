// supabaseClient.js - Supabase client initialization

// Supabase credentials
const SUPABASE_URL = 'https://fzaeyhihqlznfenkyrhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6YWV5aGlocWx6bmZlbmt5cmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODk2MDYsImV4cCI6MjA3Nzg2NTYwNn0.dNA9OSZXqaTXLLcE3TakJhzfHZ9xfy51empFBWGbR7k';

// Initialize Supabase client
const { createClient } = supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized');