<script>
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  // Si el usuario ya está logueado, redirige a la página principal
  onMount(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      goto('/');
    }
  });

  async function signIn() {
    loading = true;
    error = '';
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (err) error = err.message;
    else goto('/');
  }

  async function signUp() {
    loading = true;
    error = '';
    const { error: err } = await supabase.auth.signUp({ email, password });
    loading = false;
    if (err) error = err.message;
    else error = 'Revisa tu email para confirmar el registro.';
  }
</script>

<h1>Iniciar sesión / Registrarse</h1>
<form on:submit|preventDefault={signIn}>
  <input type="email" placeholder="Email" bind:value={email} required />
  <input type="password" placeholder="Contraseña" bind:value={password} required />
  <button type="submit" disabled={loading}>Iniciar sesión</button>
  <button type="button" on:click={signUp} disabled={loading}>Registrarse</button>
</form>
{#if error}
  <p style="color:red">{error}</p>
{/if}
