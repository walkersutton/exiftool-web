import type { ParsedOutput } from '$lib/types/parsed-output';

function parseExifOutput(text: string): ParsedOutput {
	return text
		.split('\n')
		.filter((line) => line.includes(': '))
		.map((line) => {
			const writable = !line.startsWith('R:');
			const rest = writable ? line : line.slice(2);
			const sepIdx = rest.indexOf(': ');
			return {
				label: rest.slice(0, sepIdx).trim(),
				value: rest.slice(sepIdx + 2).trim(),
				writable
			};
		});
}

export { parseExifOutput };
