import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-ethical-channel-widget',
    imports: [RouterModule],
    templateUrl: './ethical-channel-widget.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EthicalChannelWidgetComponent { }
