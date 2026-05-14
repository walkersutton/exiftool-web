import { parseExifOutput } from './parse-exif-output';
import { runExifToolTask, escapePerlString, WASM_INPUT_FILE } from './exiftool-wasm';
import type { ParsedOutput } from '$lib/types/parsed-output';

async function runExifTools(browserFile: globalThis.File): Promise<ParsedOutput> {
	const escapedInput = escapePerlString(WASM_INPUT_FILE);

	const perlScript = `
        use Image::ExifTool;
        my $exif = Image::ExifTool->new();
        $exif->Options(Unknown => 1, Duplicates => 1);

        my $info = $exif->ImageInfo("${escapedInput}");
        if ($exif->GetValue("Error")) {
            print "Error: " . $exif->GetValue("Error") . "\\n";
        } else {
            foreach my $tag (sort $exif->GetTagList($info)) {
                my $isDuplicate = ($tag =~ / \\(\\d+\\)$/);
                (my $cleanTag = $tag) =~ s/ \\(\\d+\\)$//;
                my $group0 = $exif->GetGroup($tag, 0);
                my $group1 = $exif->GetGroup($tag, 1);
                my @vals = $exif->GetValue($tag);
                my $val;
                if (@vals > 1) {
                    $val = join(', ', map { defined $_ ? $_ : '' } @vals);
                } else {
                    $val = defined($vals[0]) ? $vals[0] : '';
                }
                my $isReadOnly = ($group0 =~ /^(?:File|Composite|JPEG)$/) || $isDuplicate;
                my $prefix = $isReadOnly ? 'R:' : '';
                print "$prefix$group1:$cleanTag: $val\\n";
            }
        }
    `;

	const result = await runExifToolTask(browserFile, perlScript);
	return parseExifOutput(result.stdout);
}

export { runExifTools };
