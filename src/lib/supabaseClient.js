import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aiozqizpxsznsftygomz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpb3pxaXpweHN6bnNmdHlnb216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2NzU0NjcsImV4cCI6MjA2NTI1MTQ2N30.C-zFzT7L15DKq4ScLJg85y4RvgqEetUz77yn6_X-h6c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
