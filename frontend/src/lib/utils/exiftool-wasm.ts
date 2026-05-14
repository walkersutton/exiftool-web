import { WASI, WASIProcExit } from '@bjorn3/browser_wasi_shim';
import { PreopenDirectory, File, Fd } from '@bjorn3/browser_wasi_shim';
import { instantiate } from './asyncify.js';
import { fetchZeroPerl } from './fetch-zeroperl';

export class CustomFd extends Fd {
	private chunks: Uint8Array[] = [];

	fd_write(data: Uint8Array): { ret: number; nwritten: number } {
		this.chunks.push(new Uint8Array(data));
		return { ret: 0, nwritten: data.length };
	}

	getBuffer(): Uint8Array {
		const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of this.chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		return result;
	}

	getOutput(): string {
		return new TextDecoder().decode(this.getBuffer());
	}
}

export function escapePerlString(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/@/g, '\\@');
}

export interface ExifToolResult {
	stdout: string;
	stderr: string;
	stdoutBuffer: Uint8Array;
	virtualFile: File;
	filesMap: Map<string, File>;
}

export const WASM_INPUT_FILE = '__input__';
export const WASM_OUTPUT_FILE = '__output__';

export async function runExifToolTask(
	browserFile: globalThis.File, 
	perlScript: string,
	extraFiles?: Map<string, Uint8Array>
): Promise<ExifToolResult> {
	const imageData = await browserFile.arrayBuffer();

	const stdout = new CustomFd();
	const stderr = new CustomFd();

	const fileContent = new Uint8Array(imageData);
	const virtualFile = new File(fileContent);
	const filesMap = new Map<string, File>([[WASM_INPUT_FILE, virtualFile]]);

	if (extraFiles) {
		for (const [name, data] of extraFiles) {
			filesMap.set(name, new File(data));
		}
	}

	const wasi = new WASI(
		['perl', '-e', perlScript],
		['LC_ALL=C', 'PERL_UNICODE=SD'],
		[
			new CustomFd(), // stdin
			stdout,
			stderr,
			new PreopenDirectory('/dev', new Map([['null', new File(new Uint8Array())]])),
			new PreopenDirectory('/tmp', new Map()),
			new PreopenDirectory('.', filesMap)
		],
		{ debug: false }
	);

	const imports = {
		wasi_snapshot_preview1: wasi.wasiImport,
		env: {
			memory: new WebAssembly.Memory({
				initial: 100,
				maximum: 1000,
				shared: false
			})
		}
	};

	const wasmBuffer = await fetchZeroPerl();
	const result = await instantiate(wasmBuffer, imports);
	const instance = (result as any).instance || result;

	try {
		await wasi.start(instance as any);
	} catch (e: any) {
		const isWasiExit = e instanceof WASIProcExit || e?.name === 'WASIProcExit' || (e?.message && e.message.includes('WASIProcExit'));
		if (isWasiExit) {
			const exitCode = e.code ?? e.exitCode ?? 1;
			if (exitCode !== 0) {
				const errorMsg = stderr.getOutput();
				throw new Error(`ExifTool exit code ${exitCode}${errorMsg ? ': ' + errorMsg : ''}`);
			}
		} else {
			throw e;
		}
	}

	return {
		stdout: stdout.getOutput(),
		stderr: stderr.getOutput(),
		stdoutBuffer: stdout.getBuffer(),
		virtualFile: filesMap.get(WASM_INPUT_FILE) || virtualFile,
		filesMap
	};
}
