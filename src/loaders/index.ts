import { Context } from '@azure/functions';
import dependencyInjectorLoader from './dependencyinjector';

const loader = (context: Context): void => {
  dependencyInjectorLoader(context);
};

export default loader;
