import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as s3deployment from "aws-cdk-lib/aws-s3-deployment";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from "aws-cdk-lib/aws-iam"
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as cforigin from "aws-cdk-lib/aws-cloudfront-origins";

import * as path from "path";

export class SpringPetClinicCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const applicationName = "PetClinicRest-EB-App";
        //Define an VPC for the EBS instances
        const vpc = new ec2.Vpc(this, "PetClinicCdkVpc");

        // Create an Application-Space
        const app = new elasticbeanstalk.CfnApplication(this, "PetClinicRestApplication", {
            applicationName
        });
        const s3Bucket = s3.Bucket.fromBucketArn(this, "S3BucketArtifacts", "arn:aws:s3:::pet-clinic-workshop-bucket");


        // Define the application executable that should be used in the current Version deployment
        const appVersionProps = new elasticbeanstalk.CfnApplicationVersion(this, "PetClinicRestAppVersion-1", {
            applicationName,
            sourceBundle: {
                s3Bucket: s3Bucket.bucketName,
                s3Key: "spring-petclinic-rest-3.0.2.jar"
            }
        });
        appVersionProps.addDependency(app);

        // Create a Role for the instance that allows accessing other relevant service for logging, etc.
        const ebInstanceRole = new iam.Role(this, "-aws-elasticbeanstalk-ec2-role", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        });
        const managedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier');

        ebInstanceRole.addManagedPolicy(managedPolicy);

        // Allow the EBS Role to access the S3 Bucket with the jar-File
        s3Bucket.grantRead(ebInstanceRole);
        const profileName = "PetClinicRestCdkDemoProfile";

        // Link Role and Instance
        const instanceProfile = new iam.CfnInstanceProfile(this, profileName, {
            instanceProfileName: profileName,
            roles: [
                ebInstanceRole.roleName
            ]
        });

        // Define launch configuration and environment variables
        const optionSettingProperties: elasticbeanstalk.CfnEnvironment.OptionSettingProperty[] = [
            {
                namespace: 'aws:autoscaling:launchconfiguration',
                optionName: 'InstanceType',
                value: 't3.small',
            },
            {
                namespace: 'aws:autoscaling:launchconfiguration',
                optionName: 'IamInstanceProfile',
                value: profileName
            },
            {
                namespace: 'aws:autoscaling:launchconfiguration',
                optionName: 'IamInstanceProfile',
                value: instanceProfile.attrArn,
            },
            {
                namespace: 'aws:elasticbeanstalk:application:environment',
                optionName: 'SPRING_PROFILES_ACTIVE',
                value: 'hsqldb,spring-data-jpa,cloud',
            }
        ];
        // Define the runtime for the environment, in this case Amazon Linux 2 with Java 17
        const ebs_env = new elasticbeanstalk.CfnEnvironment(this, 'Environmentm', {
            environmentName: "PetClinicRestCdkDemo-EB-Env",
            applicationName,
            solutionStackName: "64bit Amazon Linux 2 v3.6.1 running Corretto 17",
            optionSettings: optionSettingProperties,
            versionLabel: appVersionProps.ref,

        });

        // Create a bucket for Web-Hosting
        const hostingBucket = new s3.Bucket(this, "PetClinicCdkHostingBucket", {
            accessControl: s3.BucketAccessControl.PRIVATE,
            bucketName: "pet-clinic-cdk-demo-ui",
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Deploy the existing web app into the bucket
        new s3deployment.BucketDeployment(this, "BucketDeployment", {
            destinationBucket: hostingBucket,
            sources: [s3deployment.Source.asset(path.resolve("../spring-petclinic-angular-master/dist"))]
        });

        // create an origin access identity, which is allowed to read from our web hosting bucket
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, "PetClinicCdkDemoOriginAccess", {});

        hostingBucket.grantRead(originAccessIdentity);

        // Create the actual cloud front distribution
        const distribution = new cloudfront.Distribution(this, "PetClinicCdkDemoDistribution", {
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: new cforigin.S3Origin(hostingBucket, {originAccessIdentity}),
            },
            // Angular Routing behavior
            errorResponses: [{
                httpStatus: 403,
                responseHttpStatus: 200,
                responsePagePath: "/index.html"
            },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html"
                }, {
                    httpStatus: 402,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html"
                }]
        });

    }
}
