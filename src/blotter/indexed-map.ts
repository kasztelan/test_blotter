import { computed, observable, ObservableMap } from 'mobx';
import mapValues from 'lodash-es/mapValues';

export class IndexedMap<T> {
  @observable public array: T[] = observable.array([]);
  public map: {[key: string]: number} = {};

  public get = (key: string): T => {
    return this.array[this.map[key]];
  }

  public set = (key: string, elem: T) => {
    this.array.push(elem);
    this.map[key] = this.array.length - 1;
  }

  public delete = (key: string) => {
    const index = this.map[key];
    this.array.splice(index, 1);
    delete this.map[key];
    this.map = mapValues(this.map, value => {
      if (value > index) {
        return value - 1;
      } else {
        return value;
      }
    })
  }


  public replace = (map: IndexedMap<T>) => {
    this.array = map.array;
    this.map = map.map;
  }

  public forEach = (func: (elem: T) => void) => {
    return this.array.forEach(func);
  }

  public getArray() {
    return this.array;
  }

  @computed
  public get size() {
    return this.array.length;
  }
}
