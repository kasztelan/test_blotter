import { action, observable } from 'mobx';
import forEach from 'lodash-es/forEach';

export class ViewModel {
  // @ts-ignore
  @observable public isGroup: boolean;
  // @ts-ignore
  @observable public isExpanded: boolean;

  @observable public isLoading: boolean = false;

  // @ts-ignore
  public isChildren: boolean;

  @observable public children = observable.array<ViewModel>([]);

  public orderId!: string;

  public serverIndex!: number;

  constructor(data?: any) {
    if (data) {
      forEach(data, (value: any, key: any) => {
        // @ts-ignore
        this[key] = value;
      });
    }
  }

  @action
  public setExpanded = (expanded: boolean) => {
    this.isExpanded = expanded;
  };

}
