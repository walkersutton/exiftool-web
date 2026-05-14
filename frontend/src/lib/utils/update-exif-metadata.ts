import { runExifToolTask, escapePerlString, WASM_INPUT_FILE, WASM_OUTPUT_FILE } from './exiftool-wasm';

async function updateExifMetadata(
	browserFile: globalThis.File, 
	updates: Record<string, string>
): Promise<globalThis.File> {
	try {
		const fileName = browserFile.name;
		
		let updateCommands = '';
		for (const [tag, value] of Object.entries(updates)) {
            const escapedTag = escapePerlString(tag);
            const escapedValue = escapePerlString(value);
			updateCommands += `{
                my ($n, $err) = $exif->SetNewValue("${escapedTag}", "${escapedValue}");
                if (defined $err) {
                    push @setIssues, "${escapedTag}: " . $err;
                } elsif (!$n) {
                    push @setIssues, "${escapedTag}: value not accepted (rejected or identical to current)";
                }
            }
`;
		}

		const perlScript = `
        eval {
            use Image::ExifTool;
            my $exif = new Image::ExifTool;
            $exif->Options(Duplicates => 1, IgnoreMinorErrors => 1);
            $exif->ExtractInfo("${WASM_INPUT_FILE}");
            my @setIssues;
            ${updateCommands}
            foreach my $issue (@setIssues) {
                print STDERR "SetNewValue issue: $issue\\n";
            }
            my $c = $exif->CountNewValues();
            print STDERR "Staged $c new values for writing...\\n";
            my $result = $exif->WriteInfo("${WASM_INPUT_FILE}", "${WASM_OUTPUT_FILE}");
            my @warnings = $exif->GetValue('Warning');
            foreach my $w (@warnings) {
                next unless defined $w && length $w;
                print STDERR "ExifTool warning: $w\\n";
            }
            if ($result == 1) {
                print STDERR "Write succeeded.\\n";
            } elsif ($result == 2) {
                print STDERR "Nothing to write (result 2).\\n";
                my @reasons = (@setIssues, grep { defined && length } @warnings);
                my $msg = @reasons
                    ? "ExifTool did not write any changes: " . join('; ', @reasons)
                    : "ExifTool reported nothing to write. The new value may already match the stored value after normalization, or this tag may not be writable in this file format.";
                print STDERR "WRITE_FAILED: $msg\\n";
            } else {
                my $err = $exif->GetValue("Error") || "Unknown error";
                die "Error writing metadata: $err\\n";
            }
        };
        if ($@) {
            print STDERR "Perl Crash: $@\\n";
            exit(1);
        }
        `;

		console.log('Running Perl script:', perlScript);
		const result = await runExifToolTask(browserFile, perlScript);
		console.log('ExifTool stderr:', result.stderr);

		const outputFile = result.filesMap.get(WASM_OUTPUT_FILE);
		if (!outputFile || outputFile.data.length === 0) {
			const writeFailed = result.stderr.match(/^WRITE_FAILED:\s*(.+)$/m);
			if (writeFailed) {
				throw new Error(writeFailed[1].trim());
			}
			throw new Error('ExifTool could not write these changes.\nLogs: ' + result.stderr);
		}

		return new globalThis.File([outputFile.data as any], fileName, {
			type: browserFile.type,
			lastModified: Date.now()
		});
	} catch (error) {
		console.error('Error updating metadata:', error);
		throw error;
	}
}

export { updateExifMetadata };
