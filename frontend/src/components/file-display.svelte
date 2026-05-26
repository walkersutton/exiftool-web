<script lang="ts">
    import type { ParsedOutput } from "$lib/types/parsed-output";
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { clsx } from 'clsx';
    import { updateExifMetadata } from '$lib/utils/update-exif-metadata';

    const dispatch = createEventDispatcher<{ 
        saved: { modifiedFile: globalThis.File; changes: Record<string, string> };
    }>();

    export let fileUrl: string;
    export let currentFile: File | null;
    export let output: ParsedOutput;
    export let isSaving = false;
    export let hasSavedChanges = false;
    export let savedFile: File | null = null;

    let container: HTMLDivElement;
    let searchTerm = '';
    let filteredOutput: ParsedOutput = [];
    let isEditing = false;
    let originalValues = new Map<string, string>();
    let saveError = '';

    $: if (currentFile) {
        if (container) {
            container.scrollTop = 0;
        }
    }

    $: {
        if (output?.length > 0) {
            if (searchTerm.trim() === '') {
                filteredOutput = output;
            } else {
                const term = searchTerm.toLowerCase();
                filteredOutput = output.filter(
                    item => item.label.toLowerCase().includes(term) || 
                           item.value.toLowerCase().includes(term)
                );
            }
        } else {
            filteredOutput = [];
        }
    }

    async function handleSave() {
        if (!currentFile) return;
        isSaving = true;
        saveError = '';
        const updates: Record<string, string> = {};
        for (const item of output) {
            if (item.writable && originalValues.get(item.label) !== item.value) {
                updates[item.label] = item.value;
            }
        }
        try {
            if (Object.keys(updates).length > 0) {
                const modifiedFile = await updateExifMetadata(currentFile, updates);
                savedFile = modifiedFile;
                hasSavedChanges = true;
                dispatch('saved', { modifiedFile, changes: updates });
            }
        } catch (e: any) {
            saveError = e?.message ?? 'Save failed.';
        } finally {
            isSaving = false;
        }
    }

    function handleDownload() {
        if (!savedFile) return;
        const url = URL.createObjectURL(savedFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = savedFile.name;
        a.click();
        URL.revokeObjectURL(url);
    }

    function toggleEditing() {
        if (!isEditing) {
            originalValues = new Map(output.map(item => [item.label, item.value]));
            isEditing = true;
            if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/edit');
            }
        }
    }

    function handleCancel() {
        isEditing = false;
        hasSavedChanges = false;
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
        }
    }
</script>

<div bind:this={container} class="w-full md:w-[65%] flex flex-col gap-4 max-h-[300px] md:max-h-[600px] md:min-w-[550px] overflow-auto bg-gray-100 border border-gray-300 rounded px-5 pb-5 pt-2.5">
    <div class="flex flex-row items-center justify-between">
        <h2 class="text-lg md:text-2xl md:py-3 py-2 font-mono font-extrabold">Metadata</h2>
        {#if currentFile && output?.length > 0}
            <div class="flex items-center gap-3" transition:fade={{ duration: 150 }} >
                {#if isEditing}
                    <div class="flex items-center gap-3" transition:fade={{ duration: 150 }}>
                        <button 
                            type="button" 
                            class="px-2 md:px-3 py-1 md:py-1.5 bg-gray-200 text-gray-700 rounded text-xs md:text-sm hover:bg-gray-300 border border-gray-300 transition-colors font-medium whitespace-nowrap"
                            on:click={handleCancel}
                        >
                            Cancel
                        </button>
                        {#if hasSavedChanges}
                            <button 
                                type="button" 
                                class="px-2 md:px-3 py-1 md:py-1.5 bg-blue-500 text-white rounded text-xs md:text-sm hover:bg-blue-600 transition-colors font-medium whitespace-nowrap"
                                on:click={handleDownload}
                            >
                                Download
                            </button>
                        {:else}
                            <button 
                                type="submit" 
                                form="metadata-form"
                                disabled={isSaving}
                                class="px-2 md:px-3 py-1 md:py-1.5 bg-blue-500 text-white rounded text-xs md:text-sm hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
                            >
                                Save
                            </button>
                        {/if}
                    </div>
                {/if}
                <input 
                    type="text" 
                    placeholder="Search metadata..." 
                    bind:value={searchTerm}
                    class="hidden md:block px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        {/if}
    </div>
    {#if currentFile}
        <div class="w-full overflow-auto transition-all duration-300 ease-in-out opacity-0 {fileUrl ? 'opacity-100' : ''} min-h-[200px]">
            {#if output?.length > 0}
                <form 
                    id="metadata-form"
                    on:submit|preventDefault={handleSave}
                    class="p-1"
                >
                    <div class="flex flex-col gap-1 md:grid md:grid-cols-2 md:gap-2 font-mono text-xs lg:text-base md:text-base">
                        {#each filteredOutput as item}
                            <div class="font-semibold {item.writable ? '' : 'text-gray-400'}">{item.label}</div>
                            <input
                                class={clsx(
                                    "mb-2 md:mb-0 p-1 rounded focus:outline-none transition-all duration-300 ease-in-out border",
                                    !item.writable
                                        ? "bg-transparent border-transparent text-gray-400 cursor-default select-none"
                                        : isSaving
                                            ? "bg-gray-200 border-gray-300 cursor-not-allowed"
                                            : (isEditing
                                                ? "bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 shadow-sm shadow-blue-50/50"
                                                : "bg-transparent border-transparent cursor-pointer hover:bg-gray-200")
                                )}
                                bind:value={item.value}
                                readonly={!isEditing || !item.writable}
                                disabled={isSaving}
                                on:click={item.writable ? toggleEditing : undefined}
                            />
                        {/each}
                    </div>
                </form>
                {#if saveError}
                    <p transition:fade={{ duration: 150 }} class="mt-2 text-xs text-red-600 font-mono">{saveError}</p>
                {/if}
                {#if filteredOutput.length === 0 && searchTerm.trim() !== ''}
                    <div class="flex justify-center items-center h-full text-gray-500 font-mono text-sm md:text-base">
                        No metadata matches your search
                    </div>
                {/if}
            {:else}
                <div class="flex justify-center items-center h-full text-gray-500 font-mono text-sm md:text-base">
                    exiftool could not properly be run on this file.
                </div>
            {/if}
        </div>
    {:else}
        <div class="flex justify-center items-center h-[200px] text-gray-500 text-sm md:text-base">
            Preview will appear here
        </div>
    {/if}
</div>