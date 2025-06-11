<script>
  import { supabase } from '$lib/supabaseClient';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';

  let user = null;
  let loading = true;
  let lists = [];
  let newListName = '';
  let listsLoading = false;
  let listsError = '';

  let openListId = null;
  // Cambios: productos y estados por lista
  let itemsByList = {};
  let itemsLoadingByList = {};
  let itemsErrorByList = {};
  let newItemNameByList = {};

  // Guardar referencias a los canales para evitar duplicados
  let itemChannels = {};

  // Compartir listas
  let shareEmailByList = {};
  let shareErrorByList = {};
  let shareSuccessByList = {};

  onMount(async () => {
    const { data } = await supabase.auth.getUser();
    user = data.user;
    loading = false;
    if (!user) {
      goto('/login');
    } else {
      await fetchLists();
      // Suscripción en tiempo real
      supabase.channel('public:shopping_lists')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, fetchLists)
        .subscribe();
    }
  });

  async function fetchLists() {
    listsLoading = true;
    listsError = '';
    // Listas donde el usuario es owner o está en shopping_list_users
    const { data, error } = await supabase.rpc('get_user_lists');
    if (error) listsError = error.message;
    else lists = data;
    listsLoading = false;
  }

  async function createList() {
    if (!newListName.trim()) return;
    const { error } = await supabase.from('shopping_lists').insert({ name: newListName, owner: user.id });
    if (error) {
      listsError = error.message;
    } else {
      newListName = '';
      fetchLists();
    }
  }

  async function fetchItems(listId) {
    itemsLoadingByList[listId] = true;
    itemsErrorByList[listId] = '';
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });
    if (error) itemsErrorByList[listId] = error.message;
    else itemsByList[listId] = data;
    itemsLoadingByList[listId] = false;
  }

  async function toggleList(listId) {
    if (openListId === listId) {
      // Cerrar la lista y limpiar canal
      if (itemChannels[listId]) {
        await supabase.removeChannel(itemChannels[listId]);
        delete itemChannels[listId];
      }
      openListId = null;
    } else {
      // Cerrar canal anterior si hay otra lista abierta
      if (openListId && itemChannels[openListId]) {
        await supabase.removeChannel(itemChannels[openListId]);
        delete itemChannels[openListId];
      }
      openListId = listId;
      await fetchItems(listId);
      // Suscripción en tiempo real a los items de la lista
      const channel = supabase.channel('public:shopping_list_items_' + listId);
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${listId}` }, (payload) => {
        // Solo refrescar si la lista está abierta
        if (openListId === listId) fetchItems(listId);
      });
      await channel.subscribe();
      itemChannels[listId] = channel;
    }
  }

  async function addItem(listId) {
    const name = newItemNameByList[listId];
    if (!name?.trim() || !listId) return;
    const { error } = await supabase.from('shopping_list_items').insert({ name, list_id: listId });
    if (error) itemsErrorByList[listId] = error.message;
    newItemNameByList[listId] = '';
    // No llamar a fetchItems aquí, la suscripción lo hará automáticamente
  }

  async function toggleChecked(item) {
    await supabase.from('shopping_list_items').update({ checked: !item.checked }).eq('id', item.id);
  }

  async function deleteItem(item) {
    await supabase.from('shopping_list_items').delete().eq('id', item.id);
  }

  async function shareList(listId) {
    shareErrorByList[listId] = '';
    shareSuccessByList[listId] = '';
    const email = shareEmailByList[listId]?.trim();
    if (!email) {
      shareErrorByList[listId] = 'Introduce un email válido.';
      return;
    }
    // Buscar usuario por email
    const { data: users, error } = await supabase.auth.admin.listUsers({ email });
    if (error) {
      shareErrorByList[listId] = 'Error buscando usuario.';
      return;
    }
    const user = users?.users?.find(u => u.email === email);
    if (!user) {
      shareErrorByList[listId] = 'No existe un usuario con ese email.';
      return;
    }
    // Insertar en shopping_list_users
    const { error: insertError } = await supabase.from('shopping_list_users').insert({ list_id: listId, user_id: user.id, can_edit: true });
    if (insertError) {
      shareErrorByList[listId] = 'No se pudo compartir la lista.';
    } else {
      shareSuccessByList[listId] = 'Lista compartida correctamente.';
      shareEmailByList[listId] = '';
    }
  }

  onDestroy(() => {
    // Limpiar todos los canales al salir de la página
    Object.values(itemChannels).forEach(channel => {
      if (channel) supabase.removeChannel(channel);
    });
    itemChannels = {};
  });
</script>

<style>
  .listas {
    list-style: none;
    padding: 0;
    max-width: 500px;
    margin: 0 auto;
  }
  .listas > li {
    background: #f8f9fa;
    margin-bottom: 1em;
    border-radius: 8px;
    box-shadow: 0 2px 8px #0001;
    padding: 1em;
    transition: box-shadow 0.2s;
  }
  .listas > li:focus-within, .listas > li:hover {
    box-shadow: 0 4px 16px #0002;
  }
  .list-title-btn {
    background: none;
    border: none;
    font-size: 1.2em;
    font-weight: bold;
    cursor: pointer;
    color: #2d6cdf;
    margin-bottom: 0.5em;
  }
  .productos {
    margin-left: 0.5em;
    margin-top: 0.5em;
  }
  .productos ul {
    list-style: none;
    padding: 0;
  }
  .productos li {
    display: flex;
    align-items: center;
    margin-bottom: 0.3em;
    background: #fff;
    border-radius: 5px;
    padding: 0.3em 0.6em;
    box-shadow: 0 1px 3px #0001;
  }
  .productos input[type="checkbox"] {
    margin-right: 0.7em;
  }
  .productos button {
    margin-left: auto;
    background: #ff4d4f;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.2em 0.7em;
    cursor: pointer;
    font-size: 0.9em;
  }
  .productos button:hover {
    background: #d9363e;
  }
  .form-inline {
    display: flex;
    gap: 0.5em;
    margin-bottom: 0.5em;
  }
  .form-inline input {
    flex: 1;
    padding: 0.4em;
    border-radius: 4px;
    border: 1px solid #ccc;
  }
  .form-inline button {
    background: #2d6cdf;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.4em 1em;
    cursor: pointer;
    font-size: 1em;
  }
  .form-inline button:hover {
    background: #1a4fa3;
  }
  .share-msg {
    margin: 0.2em 0 0.5em 0;
    font-size: 0.95em;
  }
  .checked {
    text-decoration: line-through;
    color: #888;
  }
</style>

{#if loading}
  <p>Cargando...</p>
{:else if user}
  <h1>Bienvenido, {user.email}</h1>
  <form on:submit|preventDefault={createList} style="margin-bottom:1em">
    <input type="text" placeholder="Nueva lista" bind:value={newListName} />
    <button type="submit">Crear lista</button>
  </form>
  {#if listsLoading}
    <p>Cargando listas...</p>
  {:else if listsError}
    <p style="color:red">{listsError}</p>
  {:else if lists.length === 0}
    <p>No tienes listas aún.</p>
  {:else}
    <ul class="listas">
      {#each lists as list}
        <li>
          <button class="list-title-btn" on:click={() => toggleList(list.id)}>{list.name}</button>
          {#if openListId === list.id}
            <div class="productos">
              <!-- Compartir lista -->
              <form class="form-inline" on:submit|preventDefault={() => shareList(list.id)}>
                <input type="email" placeholder="Email para compartir" bind:value={shareEmailByList[list.id]} />
                <button type="submit">Compartir</button>
              </form>
              {#if shareErrorByList[list.id]}
                <div class="share-msg" style="color:red">{shareErrorByList[list.id]}</div>
              {/if}
              {#if shareSuccessByList[list.id]}
                <div class="share-msg" style="color:green">{shareSuccessByList[list.id]}</div>
              {/if}
              <!-- Añadir producto -->
              <form class="form-inline" on:submit|preventDefault={() => addItem(list.id)}>
                <input type="text" placeholder="Nuevo producto" bind:value={newItemNameByList[list.id]} />
                <button type="submit">Añadir</button>
              </form>
              {#if itemsLoadingByList[list.id]}
                <p>Cargando productos...</p>
              {:else if itemsErrorByList[list.id]}
                <p style="color:red">{itemsErrorByList[list.id]}</p>
              {:else if !itemsByList[list.id] || itemsByList[list.id].length === 0}
                <p>No hay productos en esta lista.</p>
              {:else}
                <ul>
                  {#each itemsByList[list.id] as item}
                    <li>
                      <input type="checkbox" checked={item.checked} on:change={() => toggleChecked(item)} />
                      <span class:item.checked>{item.name}</span>
                      <button on:click={() => deleteItem(item)}>Eliminar</button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}
