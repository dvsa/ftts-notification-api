import { Context } from '@azure/functions';
import dependencyInjectorLoader from './dependencyinjector';
import envLoader from './env';

const loader = (context: Context): void => {
  envLoader();
  dependencyInjectorLoader(context);
};

export default loader;
