import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../config/environment';

@Pipe({
    name: 'fileUrl',
})
export class FileUrlPipe implements PipeTransform {
    transform(path: string | null | undefined): string {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:')) return path;

        // Ensure we use the base URL for relative paths
        const cleanApiUrl = environment.apiUrl.replace('/api', '');
        return `${cleanApiUrl}${path}`;
    }
}
