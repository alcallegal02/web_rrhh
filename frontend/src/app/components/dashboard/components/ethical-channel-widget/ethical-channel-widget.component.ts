import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-ethical-channel-widget',
    imports: [RouterModule, NgIconComponent],
    templateUrl: './ethical-channel-widget.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EthicalChannelWidgetComponent { }
