// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const environment = {
    production: false,
    REST_API_URL: 'http://http://ec2-18-202-240-234.eu-west-1.compute.amazonaws.com:9966/petclinic/api/'
};
