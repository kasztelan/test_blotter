import { Subject } from 'rxjs';
import shuffle from 'lodash-es/shuffle'
import * as mockDataJSON from './mock.json';
import { ViewModel } from './view-model';

let mockData = mockDataJSON as any[];

export interface IDataQuery {
  limit: number;
  offset?: number
}

export interface IDataQueryResponse {
  data: (IAddElement | IRemoveElements | IUpdateELement)[];
  limit: number;
  offset: number;
}

export interface IAddElement {
  action: 'A',
  data: any;
}

export interface IRemoveElements {
  action: 'D',
  orderIds: string[];
}

export interface IUpdateELement {
  action: 'U'
  orderId: string,
  data: any;
}

export interface IChildrenQueryResponse {
  data: any[];
  orderId: string;
}

export interface IAnchorChangeResponse {
  anchorOffset: number;
}

export class MockServer {
  public stream$: Subject<IDataQueryResponse>;
  public childrenStream$: Subject<IChildrenQueryResponse>;
  public onAddRemoveRows$: Subject<IDataQueryResponse>;
  public onAnchorChange$: Subject<IAnchorChangeResponse>;

  private startRow!: number;
  private endRow!: number;

  private data: any = mockData;

  constructor() {
    this.stream$ = new Subject<IDataQueryResponse>();
    this.childrenStream$ = new Subject<IChildrenQueryResponse>();
    this.onAddRemoveRows$ = new Subject<IDataQueryResponse>();
    this.onAnchorChange$ = new Subject<IAnchorChangeResponse>();
  }

  public getData = (query: IDataQuery) => {
    const offset = query.offset || 0;
    const startRow = offset;
    const endRow = offset + query.limit;

    setTimeout(() => {
      const dataSlice = mockData.slice(startRow, endRow).map(elem => {
        return {
          action: 'A',
          data: elem
        }
      }) as (IAddElement | IRemoveElements | IUpdateELement)[];

      console.log('SERVER: sending data', {data: dataSlice, startRow: startRow, endRow: endRow});
      this.stream$.next({
        data: shuffle(dataSlice),
        limit: query.limit,
        offset: offset
      });
      this.startRow = startRow;
      this.endRow = endRow;

    }, this.randomInt(250, 1000));
  };

  private childrenCount: any = {};

  public getChildren = (orderId: string) => {
    const childrenData: any[] = [];

    if (!this.childrenCount[orderId]) {
      this.childrenCount[orderId] = this.randomInt(2, 20);
    }

    for (let i=1; i < this.childrenCount[orderId]; i++) {
      childrenData.push({
        orderId: orderId + '_' + i
      });
    }
    setTimeout(() => {
      console.log('SERVER: sending children data', {data: childrenData, orderId});
      this.childrenStream$.next({data: childrenData, orderId});
    }, this.randomInt(250, 1000))
  }

  private randomInt = (min: number, max: number) => {
    return Math.floor(Math.random()*(max-min+1)+min);
  }

  public removeAtIndexes = (indexes: string) => {
    const indexesArr = indexes.split(",");
    const orderIds = indexesArr.map(index => mockData[Number(index)].orderId);
    const indexesAboveAchor = indexesArr.filter(index => Number(index) < this.startRow);
    const indexesUnderAchor = indexesArr.filter(index => Number(index) >= this.startRow);


    // under anchor

    if (indexesUnderAchor.length) {

      const underAnchorOrderIds = indexesUnderAchor.map(index => mockData[Number(index)].orderId);
      const count = underAnchorOrderIds.length;

      const data: any[] = [
        {
          action: 'D',
          orderIds: underAnchorOrderIds
        }
      ];

      for (let i = 0; i < count; i++) {
        data.push({
          action: 'A',
          data: mockData[this.endRow + i]
        });
      }

      this.onAddRemoveRows$.next({
        data: shuffle(data),
        limit: this.endRow - this.startRow,
        offset: this.startRow
      });
    }


    // above anchor
    if (indexesAboveAchor.length) {
      this.startRow -= indexesAboveAchor.length;
      this.endRow -= indexesAboveAchor.length;

      this.onAnchorChange$.next({
        anchorOffset: -1 * indexesAboveAchor.length
      });
    }

    mockData = mockData.filter(elem => orderIds.indexOf(elem.orderId) === -1)
  }

  public addOrder = (orderId: string) => {
    const order = {
      orderId
    }

    mockData.push(order);

    const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
    mockData = mockData.sort((a: ViewModel, b: ViewModel) => {
      return collator.compare(a.orderId, b.orderId)
    });

    if (mockData.indexOf(order) < this.startRow) {
      this.onAnchorChange$.next({
        anchorOffset: 1
      });
    } else {
      this.onAddRemoveRows$.next({
        data: [{action: 'A', data: order}],
        limit: this.endRow - this.startRow,
        offset: this.startRow
      });
    }
  }
}