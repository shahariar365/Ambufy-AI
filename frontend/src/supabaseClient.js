import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xwiauzikjiorooslsiwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3aWF1emlramlvcm9vc2xzaXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTIzODgsImV4cCI6MjA5MTI4ODM4OH0.JCIGLAeWSHpIxld6y8gLYQphFB0jWkFK02iEeden2qc';

export const supabase = createClient(supabaseUrl, supabaseKey);