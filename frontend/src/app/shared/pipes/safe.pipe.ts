import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeStyle, SafeScript, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safe',
  standalone: true
})
export class SafePipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Transforms content into safe values
   * @param value The content to sanitize
   * @param type The type of safety needed: 'html' | 'style' | 'script' | 'url' | 'resourceUrl'
   */
  transform(value: string | undefined | null, type: string): SafeHtml | SafeStyle | SafeScript | SafeUrl | SafeResourceUrl {
    if (!value) return '';
    
    switch (type) {
      case 'html': return this.sanitizer.bypassSecurityTrustHtml(value);
      case 'style': return this.sanitizer.bypassSecurityTrustStyle(value);
      case 'script': return this.sanitizer.bypassSecurityTrustScript(value);
      case 'url': return this.sanitizer.bypassSecurityTrustUrl(value);
      case 'resourceUrl': return this.sanitizer.bypassSecurityTrustResourceUrl(value);
      default: throw new Error(`Invalid safe pipe type: ${type}`);
    }
  }
}
