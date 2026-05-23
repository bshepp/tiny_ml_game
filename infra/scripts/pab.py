import boto3, json, os, sys, urllib.parse, urllib.request
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

REGION = os.environ.get('AWS_REGION', 'us-east-1')
FUNCTION_NAME = os.environ.get('ROSHAMBOT_FUNCTION_NAME', 'roshambot-api')
session = boto3.Session(region_name=REGION)
ACCOUNT_ID = os.environ.get('AWS_ACCOUNT_ID') or session.client('sts').get_caller_identity()['Account']
ARN = f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:{FUNCTION_NAME}'
encoded = urllib.parse.quote(ARN, safe='')
PATH = sys.argv[2] if len(sys.argv) > 2 else '2024-11-15/public-access-block-config'
base = f'https://lambda.{REGION}.amazonaws.com/{PATH}/{encoded}'
print('URL:', base)

creds = session.get_credentials().get_frozen_credentials()

def call(method, body=None):
    req = AWSRequest(method=method, url=base, data=body, headers={'Content-Type': 'application/json'} if body else {})
    SigV4Auth(creds, 'lambda', REGION).add_auth(req)
    prepared = urllib.request.Request(base, data=body.encode() if body else None, method=method, headers=dict(req.headers))
    try:
        with urllib.request.urlopen(prepared) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

action = sys.argv[1] if len(sys.argv) > 1 else 'get'
if action == 'get':
    print(call('GET'))
elif action == 'put':
    body = json.dumps({
        'PublicAccessBlockConfig': {
            'BlockPublicPolicy': False,
            'RestrictPublicResource': False,
        }
    })
    print(call('PUT', body))
elif action == 'delete':
    print(call('DELETE'))
