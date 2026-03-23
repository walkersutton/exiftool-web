<script lang="ts">
	import type { ParsedOutput } from "$lib/types/parsed-output";
	import { runExifTools } from "$lib/utils/run-exif-tools";
	import FileDisplay from "../components/file-display.svelte";
	import FilePreview from "../components/file-preview.svelte";

	let output: ParsedOutput;
	let dropzone: HTMLDivElement;
	let isDragging = false;
	let isSaving = false;
	let fileInput: HTMLInputElement;
	let fileUrl: string | null = null;
	let currentFile: File | null = null;
	let files: File[] = [];

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			files = [...files, ...Array.from(droppedFiles)];
			if (!currentFile) {
				await selectFile(files[0]);
			}
		}
	}

	function handleClick() {
		fileInput.click();
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const selectedFiles = target.files;
		if (selectedFiles && selectedFiles.length > 0) {
			files = [...files, ...Array.from(selectedFiles)];
			if (!currentFile) {
				await selectFile(files[0]);
			}
		}
		// Reset input so the same file can be selected again
		target.value = '';
	}

	async function selectFile(file: File) {
		if (isSaving) return;
		currentFile = file;
		if (fileUrl) {
			URL.revokeObjectURL(fileUrl);
		}
		fileUrl = URL.createObjectURL(file);
		output = await runExifTools(file);
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

</script>

<svelte:head>
    <title>exiftool-web | Browser-based interface for exiftool</title>
    <meta name="description" content="A browser-based interface for exiftool. View and analyze image metadata directly in your browser." />
    <meta property="og:title" content="exiftool-web" />
    <meta property="og:description" content="A browser-based interface for exiftool. View and analyze image metadata directly in your browser." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="exiftool-web" />
    <meta name="twitter:description" content="A browser-based interface for exiftool. View and analyze image metadata directly in your browser." />
</svelte:head>

<div
    bind:this={dropzone}
    class="min-h-screen w-full"
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:dragover|preventDefault
    on:drop={handleDrop}
    role="button"
    aria-roledescription="Drop files here or click to select"
    tabindex="0"
>
    <main class="py-4 px-4 sm:py-4 sm:px-8 md:py-16 md:px-32 lg:py-16 lg:px-32 flex flex-col gap-8 font-mono">
        <div class="flex flex-col gap-6"> 
            <h1 class="md:text-3xl lg:text-3xl sm:text-4xl text-2xl font-mono font-bold">exiftool-web</h1>
            <p class="max-w-xl text-xs sm:text-sm md:text-sm lg:text-sm xl:text-sm text-wrap">
             All files processed on your computer (nothing saved/uploaded). View the source code (or contribute) <a href="https://github.com/lucasgelfond/exiftool-web" class="text-blue-600 underline">here</a>. Based on <a href="https://exiftool.org/" class="text-blue-600 underline">exiftool</a>, <a href="https://github.com/uswriting/zeroperl" class="text-blue-600 underline">zeroperl</a>, and <a href="https://github.com/bjorn3/browser_wasi_shim" class="text-blue-600 underline">browser_wasi_shim</a>. Made with ❤️ in San Francisco by <a href="http://lucasgelfond.online" class="text-blue-600 underline">Lucas Gelfond</a>.
            </p>
        </div>

        <input
            type="file"
            accept="*/*"
            class="hidden"
            bind:this={fileInput}
            on:change={handleFileSelect}
            multiple
        />

        {#if files.length === 0}
            <div
                class="h-[200px] min-w-[150px] sm:h-[300px] sm:min-w-[200px] md:h-[400px] md:min-w-[500px] md:max-w-[800px] border-2 border-dashed rounded flex items-center justify-center cursor-pointer transition-colors {isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}"
                on:click={handleClick}
                on:keydown={e => e.key === 'Enter' && handleClick()}
                role="button"
                tabindex="0"
            >
                <p class="text-base md:text-xl">
                    <span class="hidden sm:inline">Drop files here or click to select</span>
                    <span class="sm:hidden">Select a file</span>
                </p>
            </div>
        {:else}
            <div class="flex flex-col-reverse md:flex-row lg:flex-row gap-8">
                <div class="w-full md:w-[25%] lg:w-[25%] min-w-[200px] flex flex-col gap-4 h-[600px]">
                    {#if currentFile && fileUrl}
                        <FilePreview file={currentFile} url={fileUrl} />
                    {/if}

                    <div
                        class="border-2 border-dashed p-4 rounded text-center cursor-pointer transition-colors {isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} hover:border-blue-500 hover:bg-blue-50"
                        on:click={handleClick}
                        on:keydown={e => e.key === 'Enter' && handleClick()}
                        on:dragenter={handleDragEnter}
                        on:dragleave={handleDragLeave}
                        on:dragover|preventDefault
                        on:drop={handleDrop}
                        role="button"
                        tabindex="0"
                    >
                        Add more files
                    </div>

                    <div class="flex flex-col gap-2 overflow-auto">
                        {#each files.reverse() as file}
                            <button
                                class="flex flex-col gap-1 p-3 text-left border rounded hover:bg-gray-50 transition-colors {file === currentFile ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} {isSaving ? 'cursor-not-allowed opacity-60' : ''}"
                                on:click={() => selectFile(file)}
                                disabled={isSaving}
                            >
                                <div class="font-mono truncate">{file.name}</div>
                                <div class="text-sm text-gray-500 font-mono">
                                    <div>{file.type || 'Unknown type'}</div>
                                    <div>{formatFileSize(file.size)} • {new Date(file.lastModified).toLocaleDateString()}</div>
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>
                {#if fileUrl}
                    <FileDisplay {fileUrl} currentFile={currentFile} {output} bind:isSaving />
                {/if}
            </div>
        {/if}
    </main>
</div>
